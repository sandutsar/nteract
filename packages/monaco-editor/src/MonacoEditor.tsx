import { Channels } from "@nteract/messaging";
import { CellType, CellId } from "@nteract/commutable";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import * as React from "react";
import { completionProvider } from "./completions/completionItemProvider";
import { ContentRef } from "@nteract/core";
import { DocumentUri } from "./documentUri";
import debounce from "lodash.debounce";
import { scheduleEditorForLayout, IEditor } from "./layoutSchedule";
import * as resizeObserver from "./resizeObserver";
import * as intersectionObserver from "./intersectionObserver";

export type IModelContentChangedEvent = monaco.editor.IModelContentChangedEvent;

/**
 * This adds an additional padded area around the editor for the mouse
 * to move around before we decide to hide the popup. This makes the
 * transition less erratic and hopefully a smoother experience.
 */
const HOVER_BOUND_DEFAULT_PADDING: number = 5;

/**
 * Settings for configuring keyboard shortcuts with Monaco
 */
export interface IMonacoShortCutProps {
  cellType: CellType;
  cellFocusDirection: string | undefined;
  setCellFocusDirection: (direction?: string) => void;
  focusCell: (payload: { id: CellId; contentRef: ContentRef }) => void;
  focusAboveCellCommandMode: () => void;
  focusBelowCellCommandMode: () => void;
  insertCellBelow: (contentRef: ContentRef, cellType: CellType) => void;
  executeCell: () => void;
  focusEditor: () => void;
  focusNextCellEditor: (setPosition?: boolean) => void;
  focusPreviousCellEditor: () => void;
  unfocusEditor: () => void;
}

/**
 * Common props passed to the editor component
 */
export interface IMonacoComponentProps {
  id: string;
  contentRef: ContentRef;
  theme: string;
  readOnly?: boolean;
  channels?: Channels | undefined;
  value: string;
  editorType?: string;
  editorFocused?: boolean;
  onChange?: (value: string, event?: any) => void;
  onFocusChange?: (focus: boolean) => void;
}

/**
 * Props passed for configuring Monaco Editor
 */
export interface IMonacoConfiguration {
  /**
   * modelUri acts an identifier to query the editor model
   * without being tied to the UI
   * Calling the getModel(modelUri) API
   */
  modelUri?: monaco.Uri;
  enableCompletion?: boolean;
  shouldRegisterDefaultCompletion?: boolean;
  onCursorPositionChange?: (selection: monaco.ISelection | null) => void;
  onRegisterDocumentFormattingEditProvider?: (languageId: string) => void;
  enableFormatting?: boolean;
  onRegisterCompletionProvider?: (languageId: string) => void;
  language: string;
  lineNumbers?: boolean;
  /** For better perf in resizing, when this is true, defer and batch the layout changes to avoid each editor layouting change cause individual browser refresh */
  batchLayoutChanges?: boolean;
  /**
   * whether we call editor.layout() when the container has been resized even if the editor is not focused
   * this way we don't need special CSS styles overriding monaco's built-in styles to make the editor resize
   * This is better used together with batchLayoutChanges set to true so all editors layouts changes can be batched for better perf
   */
  shouldUpdateLayoutWhenNotFocused?: boolean;

  /**
   * whether we should call editor.layout() when the container is not in the viewport
   * default is false
   */
  skipLayoutWhenNotInViewport?: boolean;

  /**
   * whether we should call editor.layout() when the container or its parent is hidden by "display:none" or the height is set to 0
   * default is false
   */
  skipLayoutWhenHidden?: boolean;
  /** automatically adjust size to fit content, default is true */
  autoFitContentHeight?: boolean;
  /** set a max content height in number of pixels, this only works when autoFitContentHeight is true*/
  maxContentHeight?: number;

  /**
   * Set the initial dimensions of the editor layout and the container
   */
  initialDimension?: monaco.editor.IDimension;

  /** set height of editor to fit the specified number of lines in display */
  numberOfLines?: number;
  indentSize?: number;
  tabSize?: number;
  options?: monaco.editor.IEditorOptions;
  shortcutsOptions?: IMonacoShortCutProps;
  shortcutsHandler?: (editor: monaco.editor.IStandaloneCodeEditor, settings?: IMonacoShortCutProps) => void;
  cursorPositionHandler?: (editor: monaco.editor.IStandaloneCodeEditor, settings?: IMonacoProps) => void;
  commandHandler?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  onDidCreateEditor?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}

/**
 * Initial props for Monaco Editor received from agnostic component
 */
export type IMonacoProps = IMonacoComponentProps & IMonacoConfiguration;

/**
 * Creates a MonacoEditor instance
 */
export default class MonacoEditor
  extends React.Component<IMonacoProps>
  implements IEditor, intersectionObserver.IIntersectable {
  editor?: monaco.editor.IStandaloneCodeEditor;
  editorContainerRef = React.createRef<HTMLDivElement>();
  private cursorPositionListener?: monaco.IDisposable;

  private mouseMoveListener?: monaco.IDisposable;
  private intersectObservation?: () => void;
  private isInViewport = true;
  private deferredLayoutRequest = false;
  private deferredLayoutDimension?: monaco.editor.IDimension;

  constructor(props: IMonacoProps) {
    super(props);
    this.onBlur = this.onBlur.bind(this);
    this.onDidChangeModelContent = this.onDidChangeModelContent.bind(this);
    this.onFocus = this.onFocus.bind(this);
    this.onResize = this.onResize.bind(this);
    this.hideAllOtherParameterWidgets = this.hideAllOtherParameterWidgets.bind(this);
    this.handleCoordsOutsideWidgetActiveRegion = debounce(
      this.handleCoordsOutsideWidgetActiveRegion.bind(this),
      50 // Make sure we rate limit the calls made by mouse movement
    );
  }

  onDidChangeModelContent(e: monaco.editor.IModelContentChangedEvent): void {
    if (this.editor && this.props.onChange) {
      this.props.onChange(this.editor.getValue(), e);
    }
  }

  readEditorDomSize(): monaco.editor.IDimension | undefined {
    const container = this.editor?.getContainerDomNode();
    if (!container) {
      return undefined;
    }

    // use clientHeight and clientWidth from the editor.
    return {
      width: container.clientWidth,
      height: container.clientHeight
    };
  }

  getLayoutDimension(): monaco.editor.IDimension | undefined {
    const dim = this.readEditorDomSize();

    // if the container is zero sized, return undefined
    if (!dim || dim.width === 0 || dim.height === 0) {
      return undefined;
    }

    if (this.props.autoFitContentHeight ?? true) {
      // auto fit the height to the content
      const contentHeight = this.editor?.getContentHeight();
      if (contentHeight) {
        dim.height = contentHeight;
      }
    }

    if (this.props.maxContentHeight) {
      dim.height = Math.min(dim.height, this.props.maxContentHeight);
    }

    return dim;
  }

  isContainerHidden(): boolean {
    const container = this.editorContainerRef.current;
    return !container?.offsetParent || !container?.offsetHeight;
  }

  /**
   * write the layout to the DOM
   */
  layout(layout: monaco.editor.IDimension): void {
    if (!this.editor) {
      return;
    }

    this.editor.layout(layout);
  }

  /**
   * Implementation for IEditor from layoutSchedule, could cause a DOM read operation
   */
  shouldLayout(): boolean {
    return this.props.skipLayoutWhenHidden ? !this.isContainerHidden() : true;
  }

  requestLayout(dimension?: monaco.editor.IDimension): void {
    if (!this.editor) {
      return;
    }

    // check if the editor is in the viewport first since it doesn't touch the DOM
    if (!this.isInViewport) {
      this.deferredLayoutDimension = dimension;
      this.deferredLayoutRequest = true;
      return;
    }

    // when skipLayoutWhenHidden is true and the editor's parent or ancestor container is hidden,
    // we will not layout the editor.
    if (!this.shouldLayout()) {
      return;
    }

    if (this.props.batchLayoutChanges === true) {
      scheduleEditorForLayout(this, dimension);
    } else {
      if (!dimension) {
        dimension = this.getLayoutDimension();
      }

      if (dimension) {
        this.layout(dimension);
      }
    }
  }

  onIntersecting(isIntersecting: boolean): void {
    if (this.isInViewport !== isIntersecting) {
      this.isInViewport = isIntersecting;

      if (this.isInViewport && this.deferredLayoutRequest) {
        this.deferredLayoutRequest = false;
        this.requestLayout(this.deferredLayoutDimension);
      }
    }
  }

  updateIntersectRegistration(): void {
    if (this.props.skipLayoutWhenNotInViewport) {
      if (this.editorContainerRef.current && this.intersectObservation === undefined) {
        this.isInViewport = false;
        this.intersectObservation = intersectionObserver.observe(this, this.editorContainerRef.current);
      }
    } else {
      if (this.intersectObservation) {
        this.intersectObservation();
        this.intersectObservation = undefined;
      }

      // assume all editors are in viewport if skipLayoutWhenNotInViewport is false
      this.isInViewport = true;
    }
  }

  componentDidMount() {
    if (this.editorContainerRef && this.editorContainerRef.current) {
      // Register intersection observer if needed
      this.updateIntersectRegistration();

      // Register Jupyter completion provider if needed
      this.registerCompletionProvider();

      // Register document formatter if needed
      this.registerDocumentFormatter();

      // Use Monaco model uri if provided. Otherwise, create a new model uri using editor id.
      const uri = this.props.modelUri ? this.props.modelUri : monaco.Uri.file(this.props.id);

      // Only create a new model if it does not exist. For example, when we double click on a markdown cell,
      // an editor model is created for it. Once we go back to markdown preview mode that doesn't use the editor,
      // double clicking on the markdown cell will again instantiate a monaco editor. In that case, we should
      // rebind the previously created editor model for the markdown instead of recreating one. Monaco does not
      // allow models to be recreated with the same uri.
      let model = monaco.editor.getModel(uri);
      if (!model) {
        model = monaco.editor.createModel(this.props.value, this.props.language, uri);
      }

      // Set line endings to \n line feed to be consistent across OS platforms. This will auto-normalize the line
      // endings of the current value to use \n and any future values produced by the Monaco editor will use \n.
      model.setEOL(monaco.editor.EndOfLineSequence.LF);

      // Update Text model options
      model.updateOptions({
        indentSize: this.props.indentSize,
        tabSize: this.props.tabSize
      });

      // Create Monaco editor backed by a Monaco model.
      this.editor = monaco.editor.create(this.editorContainerRef.current, {
        autoIndent: "advanced",
        // Allow editor pop up widgets such as context menus, signature help, hover tips to be able to be
        // displayed outside of the editor. Without this, the pop up widgets can be clipped.
        fixedOverflowWidgets: true,
        find: {
          addExtraSpaceOnTop: false, // pops the editor out of alignment if turned on
          seedSearchStringFromSelection: "always", // default is "always"
          autoFindInSelection: "never" // default is "never"
        },
        language: this.props.language,
        lineNumbers: this.props.lineNumbers ? "on" : "off",
        minimap: {
          enabled: false
        },
        model,
        overviewRulerLanes: 0,
        padding: {
          top: 12,
          bottom: 5
        },
        readOnly: this.props.readOnly,
        // Disable highlight current line, too much visual noise with it on.
        // VS Code also has it disabled for their notebook experience.
        renderLineHighlight: "none",
        // Do not include words from the editor into the autocomplete suggestions list
        wordBasedSuggestions: false,
        scrollbar: {
          useShadows: false,
          verticalHasArrows: false,
          horizontalHasArrows: false,
          vertical: "hidden",
          horizontal: "hidden",
          verticalScrollbarSize: 0,
          horizontalScrollbarSize: 0,
          arrowSize: 30
        },
        theme: this.props.theme,
        value: this.props.value,
        dimension: this.props.initialDimension,
        // Apply custom settings from configuration
        ...this.props.options,
        // this is required, otherwise the editor will continue to change its size on layout if set to true in options overrides
        scrollBeyondLastLine: false
      });

      // Handle on create events
      if (this.props.onDidCreateEditor) {
        this.props.onDidCreateEditor(this.editor);
      }

      // Handle custom keyboard shortcuts
      if (this.editor && this.props.shortcutsHandler && this.props.shortcutsOptions) {
        this.props.shortcutsHandler(this.editor, this.props.shortcutsOptions);
      }

      // Handle custom commands
      if (this.editor && this.props.commandHandler) {
        this.props.commandHandler(this.editor);
      }

      this.toggleEditorOptions(!!this.props.editorFocused);

      if (this.props.editorFocused) {
        if (!this.editor.hasWidgetFocus()) {
          // Bring browser focus to the editor if text not already in focus
          this.editor.focus();
        }
        this.registerCursorListener();
      }

      // Adds listeners for undo and redo actions emitted from the toolbar
      this.editorContainerRef.current.addEventListener("undo", () => {
        if (this.editor) {
          this.editor.trigger("undo-event", "undo", {});
        }
      });
      this.editorContainerRef.current.addEventListener("redo", () => {
        if (this.editor) {
          this.editor.trigger("redo-event", "redo", {});
        }
      });

      // Resize Editor container on content size change
      this.editor.onDidContentSizeChange((info) => {
        if (info.contentHeightChanged && (this.props.autoFitContentHeight ?? true)) {
          const layout = this.editor?.getLayoutInfo();
          if (layout) {
            this.requestLayout({ height: info.contentHeight, width: layout.width });
          }
        }
      });

      this.editor.onDidChangeModelContent(this.onDidChangeModelContent);
      this.editor.onDidFocusEditorWidget(this.onFocus);
      this.editor.onDidBlurEditorWidget(this.onBlur);
      this.requestLayout(this.props.initialDimension);

      if (this.props.cursorPositionHandler) {
        this.props.cursorPositionHandler(this.editor, this.props);
      }

      if (this.editor) {
        this.mouseMoveListener = this.editor.onMouseMove((e: any) => {
          this.handleCoordsOutsideWidgetActiveRegion(e.event?.pos?.x, e.event?.pos?.y);
        });
      }

      // Adds listener under the resize window event which calls the resize method
      resizeObserver.observe(this, this.editorContainerRef.current);
    }
  }

  /**
   * Tells editor to check the surrounding container size and resize itself appropriately
   */
  onResize() {
    if (this.props.shouldUpdateLayoutWhenNotFocused) {
      this.requestLayout();
    } else if (this.editor && this.props.editorFocused) {
      // We call layout only for the focussed editor and resize other instances using CSS
      this.requestLayout();
    }
  }

  componentDidUpdate(prevProps: IMonacoProps) {
    if (!this.editor) {
      return;
    }

    this.updateIntersectRegistration();

    const { value, language, contentRef, id, editorFocused, theme } = this.props;

    if (this.props.cursorPositionHandler) {
      this.props.cursorPositionHandler(this.editor, this.props);
    }

    // Handle custom commands
    if (this.editor && this.props.commandHandler) {
      this.props.commandHandler(this.editor);
    }

    // Ensures that the source contents of the editor (value) is consistent with the state of the editor
    // and the value has actually changed.
    if (prevProps.value !== this.props.value && this.editor.getValue() !== this.props.value) {
      this.editor.setValue(this.props.value);
    }

    completionProvider.setChannels(this.props.channels);

    // Register Jupyter completion provider if needed
    this.registerCompletionProvider();

    // Apply new model to the editor when the language is changed.
    const model = this.editor.getModel();
    if (model && language && model.getLanguageId() !== language) {
      // Get a reference to the current editor
      const editor = this.editor;

      const newUri = DocumentUri.createCellUri(contentRef, id, language);
      if (!monaco.editor.getModel(newUri)) {
        // Save the cursor position before we set new model.
        const position = editor.getPosition();

        // Set new model targeting the changed language.
        // Note the new model should be set in a synchronous manner, if we do it asynchronously (e.g. in a setTimeout callback),
        // there could be subsequent value changes coming up modifying the old model and the new one is still with the old value.
        // Set line endings to \n line feed to be consistent across OS platforms. This will auto-normalize the line 
        // endings of the current value to use \n and any future values produced by the Monaco editor will use \n.
        const newModel = monaco.editor.createModel(value, language, newUri);
        newModel.setEOL(monaco.editor.EndOfLineSequence.LF);
        editor.setModel(newModel);

        // We need to dispose of the old model in a separate event. We cannot dispose of the model within the
        // componentDidUpdate method or else the editor will throw an exception. Zero in the timeout field
        // means execute immediately but in a seperate next event.
        setTimeout(() => {
          // Dispose the old model
          model.dispose();
        }, 0);

        // Restore cursor position to new model.
        if (position) {
          editor.setPosition(position);
        }

        // Set focus
        if (editorFocused && !editor.hasWidgetFocus()) {
          editor.focus();
        }
      }
    }

    const monacoUpdateOptions: monaco.editor.IEditorOptions & monaco.editor.IGlobalEditorOptions = {
      readOnly: this.props.readOnly
    };
    if (theme) {
      monacoUpdateOptions.theme = theme;
    }

    this.editor.updateOptions(monacoUpdateOptions);

    // In the multi-tabs scenario, when the notebook is hidden by setting "display:none",
    // Any state update propagated here would cause a UI re-layout, monaco-editor will then recalculate
    // and set its height to 5px.
    // To work around that issue, we skip updating the UI when paraent element's offsetParent is null (which
    // indicate an ancient element is hidden by display set to none)
    // We may revisit this when we get to refactor for multi-notebooks.
    if (!this.editorContainerRef.current?.offsetParent) {
      return;
    }

    // Set focus
    if (editorFocused && !this.editor.hasWidgetFocus()) {
      this.editor.focus();
    }

    // Tells the editor pane to check if its container has changed size and fill appropriately
    this.requestLayout();
  }

  componentWillUnmount() {
    if (this.editor) {
      try {
        const model = this.editor.getModel();
        // Remove the resize listener
        if (this.editorContainerRef.current) {
          resizeObserver.unobserve(this.editorContainerRef.current);
        }

        if (this.intersectObservation) {
          this.intersectObservation();
          this.intersectObservation = undefined;
        }

        if (model) {
          model.dispose();
        }

        this.editor.dispose();
        this.editor = undefined;
      } catch (err) {
        // tslint:disable-next-line
        console.error(`Error occurs in disposing editor: ${JSON.stringify(err)}`);
      }
    }

    if (this.mouseMoveListener) {
      this.mouseMoveListener.dispose();
    }
  }

  render() {
    return (
      <div className="monaco-container">
        <div ref={this.editorContainerRef} id={`editor-${this.props.id}`} />
      </div>
    );
  }

  /**
   * Register default kernel-based completion provider.
   * @param language Language
   */
  registerDefaultCompletionProvider(language: string) {
    // onLanguage event is emitted only once per language when language is first time needed.
    monaco.languages.onLanguage(language, () => {
      monaco.languages.registerCompletionItemProvider(language, completionProvider);
    });
  }

  private onFocus() {
    if (this.props.onFocusChange) {
      this.props.onFocusChange(true);
    }
    this.toggleEditorOptions(true);
    this.registerCursorListener();
  }

  private onBlur() {
    if (this.props.onFocusChange) {
      this.props.onFocusChange(false);
    }
    this.toggleEditorOptions(false);
    this.unregisterCursorListener();
    // When editor loses focus, hide parameter widgets (if any currently displayed).
    this.hideParameterWidget();
  }

  private registerCursorListener() {
    if (this.editor && this.props.onCursorPositionChange) {
      const selection = this.editor.getSelection();
      this.props.onCursorPositionChange(selection);

      if (!this.cursorPositionListener) {
        this.cursorPositionListener = this.editor.onDidChangeCursorSelection((event) =>
          this.props.onCursorPositionChange!(event.selection)
        );
      }
    }
  }

  private unregisterCursorListener() {
    if (this.cursorPositionListener) {
      this.cursorPositionListener.dispose();
      this.cursorPositionListener = undefined;
    }
  }

  /**
   * Toggle editor options based on if the editor is in active state (i.e. focused).
   * When the editor is not active, we want to deactivate some of the visual noise.
   * @param isActive Whether editor is active.
   */
  private toggleEditorOptions(isActive: boolean) {
    if (this.editor) {
      this.editor.updateOptions({
        matchBrackets: isActive ? "always" : "never",
        occurrencesHighlight: isActive,
        guides: {
          indentation: isActive
        }
      });
    }
  }

  /**
   * Register language features for target language. Call before setting language type to model.
   */
  private registerCompletionProvider() {
    const { enableCompletion, language, onRegisterCompletionProvider, shouldRegisterDefaultCompletion } = this.props;

    if (enableCompletion && language) {
      if (onRegisterCompletionProvider) {
        onRegisterCompletionProvider(language);
      } else if (shouldRegisterDefaultCompletion) {
        this.registerDefaultCompletionProvider(language);
      }
    }
  }

  private registerDocumentFormatter() {
    const { enableFormatting, language, onRegisterDocumentFormattingEditProvider } = this.props;

    if (enableFormatting && language) {
      if (onRegisterDocumentFormattingEditProvider) {
        onRegisterDocumentFormattingEditProvider(language);
      }
    }
  }

  /**
   * This will hide the parameter widget if the user is not hovering over
   * the parameter widget for this monaco editor.
   *
   * Notes: See issue https://github.com/microsoft/vscode-python/issues/7851 for further info.
   * Hide the parameter widget if the following conditions have been met:
   * - Editor doesn't have focus
   * - Mouse is not over (hovering) the parameter widget
   *
   * This method is only used for blurring at the moment given that parameter widgets from
   * other cells are hidden by mouse move events.
   *
   * @private
   * @returns
   * @memberof MonacoEditor
   */
  private hideParameterWidget() {
    if (!this.editor || !this.editor.getDomNode() || !this.editorContainerRef.current) {
      return;
    }

    // Find all elements that the user is hovering over.
    // It's possible the parameter widget is one of them.
    const hoverElements: Element[] = Array.prototype.slice.call(document.querySelectorAll(":hover"));

    // These are the classes that will appear on a parameter widget when they are visible.
    const parameterWidgetClasses = ["editor-widget", "parameter-hints-widget", "visible"];

    // Find the parameter widget the user is currently hovering over.
    let isParameterWidgetHovered = hoverElements.find((item) => {
      if (typeof item.className !== "string") {
        return false;
      }

      // Check if user is hovering over a parameter widget.
      const classes = item.className.split(" ");

      if (!parameterWidgetClasses.every((cls) => classes.indexOf(cls) >= 0)) {
        // Not all classes required in a parameter hint widget are in this element.
        // Hence this is not a parameter widget.
        return false;
      }

      // Ok, this element that the user is hovering over is a parameter widget.
      // Next, check whether this parameter widget belongs to this monaco editor.
      // We have a list of parameter widgets that belong to this editor, hence a simple lookup.
      return this.editorContainerRef.current?.contains(item);
    });

    // If the parameter widget is being hovered, don't hide it.
    if (isParameterWidgetHovered) {
      return;
    }

    // If the editor has focus, don't hide the parameter widget.
    // This is the default behavior. Let the user hit `Escape` or click somewhere
    // to forcefully hide the parameter widget.
    if (this.editor.hasWidgetFocus()) {
      return;
    }

    // If we got here, then the user is not hovering over the parameter widgets.
    // & the editor doesn't have focus.
    // However some of the parameter widgets associated with this monaco editor are visible.
    // We need to hide them.
    // Solution: Hide the widgets manually.
    this.hideWidgets(this.editorContainerRef.current, [".parameter-hints-widget"]);
  }

  /**
   * Hides widgets such as parameters and hover, that belong to a given parent HTML element.
   *
   * @private
   * @param {HTMLDivElement} widgetParent
   * @param {string[]} selectors
   * @memberof MonacoEditor
   */
  private hideWidgets(widgetParent: HTMLDivElement, selectors: string[]) {
    for (const selector of selectors) {
      for (const widget of Array.from<HTMLDivElement>(widgetParent.querySelectorAll(selector))) {
        widget.setAttribute(
          "class",
          widget.className
            .split(" ")
            .filter((cls: string) => cls !== "visible")
            .join(" ")
        );
        if (widget.style.visibility !== "hidden") {
          widget.style.visibility = "hidden";
        }
      }
    }
  }

  /**
   * Hides the parameters widgets related to other monaco editors.
   * Use this to ensure we only display parameters widgets for current editor (by hiding others).
   *
   * @private
   * @returns
   * @memberof MonacoEditor
   */
  private hideAllOtherParameterWidgets() {
    if (!this.editorContainerRef.current) {
      return;
    }
    const widgetParents: HTMLDivElement[] = Array.prototype.slice.call(
      document.querySelectorAll("div.monaco-container")
    );

    widgetParents
      .filter((widgetParent) => widgetParent !== this.editorContainerRef.current?.parentElement)
      .forEach((widgetParent) => this.hideWidgets(widgetParent, [".parameter-hints-widget"]));
  }

  /**
   * Return true if (x,y) coordinates overlap with an element's bounding rect.
   * @param {HTMLDivElement} element
   * @param {number} x
   * @param {number} y
   * @param {number} padding
   */
  private coordsInsideElement(
    element: Element | null | undefined,
    x: number,
    y: number,
    padding: number = HOVER_BOUND_DEFAULT_PADDING
  ): boolean {
    if (!element) return false;
    const clientRect = element.getBoundingClientRect();
    return (
      x >= clientRect.left - padding &&
      x <= clientRect.right + padding &&
      y >= clientRect.top - padding &&
      y <= clientRect.bottom + padding
    );
  }

  /**
   * Hide all other widgets belonging to other cells only if the currently active
   * parameter widget (at most one) is being hovered by the user.
   * @param {number} x
   * @param {number} y
   */
  private handleCoordsOutsideWidgetActiveRegion(x: number, y: number) {
    let widget = document.querySelector(".parameter-hints-widget");
    if (widget != null && !this.coordsInsideElement(widget, x, y)) {
      this.hideAllOtherParameterWidgets();
    }
  }
}
