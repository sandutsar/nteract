import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import { Observable, Observer } from "rxjs";
import { first, map } from "rxjs/operators";
import { childOf, JupyterMessage, ofMessageType, Channels } from "@nteract/messaging";

import { CompletionResults, CompletionMatch, completionRequest, js_idx_to_char_idx } from "../editor-base";

/**
 * Jupyter to Monaco completion item kinds.
 */
const unknownJupyterKind = "<unknown>";
const jupyterToMonacoCompletionItemKind: {
  [key: string]: monaco.languages.CompletionItemKind;
} = {
  [unknownJupyterKind]: monaco.languages.CompletionItemKind.Field,
  class: monaco.languages.CompletionItemKind.Class,
  function: monaco.languages.CompletionItemKind.Function,
  keyword: monaco.languages.CompletionItemKind.Keyword,
  instance: monaco.languages.CompletionItemKind.Variable,
  statement: monaco.languages.CompletionItemKind.Variable
};

/**
 * Completion item provider.
 */
class CompletionItemProvider implements monaco.languages.CompletionItemProvider {
  private channels: Channels | undefined;
  private regexWhitespace = new RegExp(/^\s*$/);

  /**
   * Set Channels of Jupyter kernel.
   */
  setChannels(channels: Channels | undefined) {
    this.channels = channels;
  }

  /**
   * Whether provider is connected to Jupyter kernel.
   */
  get isConnectedToKernel() {
    return !!this.channels;
  }

  /**
   * Additional characters to trigger completion other than Ctrl+Space.
   * We do not need any additional characters to trigger completion as the Monaco editor
   * by default triggers completion as the user types non-whitespace characters.
   */
  get triggerCharacters() {
    return [];
  }

  /**
   * Get list of completion items at position of cursor.
   */
  async provideCompletionItems(model: monaco.editor.ITextModel, position: monaco.Position) {
    // Convert to zero-based index
    let cursorPos = model.getOffsetAt(position);
    const code = model.getValue();
    cursorPos = js_idx_to_char_idx(cursorPos, code);

    // Get completions from Jupyter kernel if its Channels is connected
    let items = [];
    if (this.channels) {
      try {
        const message = completionRequest(code, cursorPos);
        items = await this.codeCompleteObservable(this.channels, message, model).toPromise();
      } catch (error) {
        // tslint:disable-next-line
        console.error(error);
      }
    }

    return Promise.resolve<monaco.languages.CompletionList>({
      suggestions: items,
      incomplete: false
    });
  }

  /**
   * Get list of completion items from Jupyter kernel.
   */
  private codeCompleteObservable(channels: Channels, message: JupyterMessage, model: monaco.editor.ITextModel) {
    // Process completion response
    const completion$ = channels.pipe(
      childOf(message),
      ofMessageType("complete_reply"),
      map((entry) => entry.content),
      first(),
      map((results) => this.adaptToMonacoCompletions(results, model))
    );

    // Subscribe and send completion request message
    return Observable.create((observer: Observer<any>) => {
      const subscription = completion$.subscribe(observer);
      channels.next(message);
      return subscription;
    });
  }

  /**
   * Converts Jupyter completion result to list of Monaco completion items.
   */
  private adaptToMonacoCompletions(results: CompletionResults, model: monaco.editor.ITextModel) {
    // Get completion list from Jupyter
    let completionItems = results.matches ?? [];
    if (results.metadata && results.metadata._jupyter_types_experimental) {
      completionItems = results.metadata._jupyter_types_experimental;
    }

    // Retrieve the text that is currently typed out which is used to determine completion
    const startPos = model.getPositionAt(results.cursor_start);
    const endPos = model.getPositionAt(results.cursor_end);
    const typedText = model.getValueInRange({
      startLineNumber: startPos.lineNumber,
      startColumn: startPos.column,
      endLineNumber: endPos.lineNumber,
      endColumn: endPos.column
    });

    const typedMagicPrefix = this.getMagicPrefix(typedText);
    const isWhitespaceFromCellStart = this.isWhitespaceFromCellStart(model, startPos);

    return completionItems
      .map((completionItem: CompletionMatch, index: number) => {
        let completionText, completionKind;
        if (typeof completionItem === "string") {
          completionText = completionItem;
          completionKind = unknownJupyterKind;
        } else {
          completionText = completionItem.text;
          completionKind = completionItem.type;
        }

        completionText = this.sanitizeText(completionText, typedText);

        let item: monaco.languages.CompletionItem | undefined = {
          kind: this.adaptToMonacoCompletionItemKind(completionKind),
          label: completionText,
          insertText: this.getInsertText(completionText, typedText, typedMagicPrefix),
          filterText: this.getFilterText(completionText, typedText),
          sortText: this.getSortText(index)
        } as monaco.languages.CompletionItem;

        const completionMagicPrefix = this.getMagicPrefix(completionText);
        if (completionMagicPrefix === "%%") {
          if (!isWhitespaceFromCellStart || startPos.column !== 1) {
            // Cell magic is not valid if there are non-whitespace from cell start to current position
            // or if it is not on the first column of a line.
            item = undefined;
          }
        } else if (completionMagicPrefix === "%") {
          if (startPos.column !== 1) {
            // Line magic is not valid if it is not on the first column of a line.
            item = undefined;
          }
        }        
        return item;
      })
      .filter((item) => item !== undefined);
  }
    
  /**
   * Get magic prefix from text.
   */
  private getMagicPrefix(text: string) {
    if(text.startsWith("%")) {
      return text.startsWith("%%") ? "%%" : "%"; 
    } else {
      return undefined;
    }
  }

  /**
   * Whether all characters from cell start position up to current start position are whitespace.
   */
  private isWhitespaceFromCellStart(model: monaco.editor.ITextModel, startPos: monaco.Position) {
    const beforeText = model.getValueInRange({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: startPos.lineNumber,
      endColumn: startPos.column
    });
    return this.regexWhitespace.test(beforeText);
  }

  /**
   * Converts Jupyter completion item kind to Monaco completion item kind.
   */
  private adaptToMonacoCompletionItemKind(kind: string) {
    const result = jupyterToMonacoCompletionItemKind[kind];
    return result ? result : jupyterToMonacoCompletionItemKind[unknownJupyterKind];
  }

  /**
   * Removes problematic prefixes based on the typed text.
   *
   * Instead of showing "some/path" we should only show "path". For paths with white space, the kernel returns
   * ""some/path with spaces"" which we want to change to ""path with spaces"".
   *
   * Additionally, typing "[]." should not suggest ".append" since this results in "[]..append".
   */
  private sanitizeText(completionText: string, typedText: string) {
    // Assumption: if the current context contains a "/" then we're currently typing a path
    const isPathCompletion = typedText.includes("/");
    if (isPathCompletion) {
      // If we have whitespace within a path, the completion for it is a string wrapped in double quotes
      // We should return only the last part of the path, wrapped in double quotes
      const completionIsPathWithWhitespace =
        completionText.startsWith('"') && completionText.endsWith('"') && completionText.length > 2; // sanity check: not empty string
      if (completionIsPathWithWhitespace && completionText.substr(1).startsWith(typedText)) {
        // sanity check: the context is part of the suggested path
        const toRemove = typedText.substr(0, typedText.lastIndexOf("/") + 1);
        return `"${completionText.substr(toRemove.length + 1)}`;
      }

      // Otherwise, display the most specific item in the path
      if (completionText.startsWith(typedText)) {
        // sanity check: the context is part of the suggested path
        const toRemove = typedText.substr(0, typedText.lastIndexOf("/") + 1);
        return completionText.substr(toRemove.length);
      }
    }

    // Handle "." after paths, since those might contain "." as well. Note that we deal with this somewhat
    // generically, but also take a somewhat conservative approach by ensuring that the completion starts with the
    // current context to ensure that we aren't applying this when we shouldn't
    const isMemberCompletion = typedText.endsWith(".");
    if (isMemberCompletion && completionText.startsWith(typedText)) {
      const toRemove = typedText.substr(0, typedText.lastIndexOf(".") + 1);
      return completionText.substr(toRemove.length);
    }

    // Handle taking only the suggestion content after the last dot. There are cases that a kernel when given
    // "suggestion1.itemA" text and typing "." that it will suggest the full path of "suggestion.itemA.itemB" instead of
    // just "itemB". The logic below handles these cases. This also handles the case where given "suggestion1.itemA.it"
    // text and typing "e" will suggest the full path of "suggestion.itemA.itemB" instead of "itemB".
    // This logic also covers that scenario.
    const index = completionText.lastIndexOf(".");
    if (index > -1 && index < completionText.length - 1) {
      return completionText.substring(index + 1);
    }

    return completionText;
  }

  /**
   * Remove magics all % characters as Monaco doesn't like them for the filtering text.
   * Without this, completion won't show magics match items.
   *
   * Also remove quotes from the filter of a path wrapped in quotes to make sure we have
   * a smooth auto-complete experience.
   */
  private getFilterText(completionText: string, typedText: string) {
    const isPathCompletion = typedText.includes("/");
    if (isPathCompletion) {
      const completionIsPathWithWhitespace =
        completionText.startsWith('"') && completionText.endsWith('"') && completionText.length > 2; // sanity check: not empty string
      if (completionIsPathWithWhitespace && completionText.substr(1).startsWith(typedText)) {
        // sanity check: the context is part of the suggested path
        return completionText.substr(1, completionText.length - 1);
      }
    }
    return completionText.replace(/%/g, "");
  }

  /**
   * Get insertion text handling what to insert for the magics case depending on what
   * has already been typed. Also handles an edge case for file paths with "." in the name.
   */
  private getInsertText(completionText: string, typedText: string, typedMagicPrefix?: string) {
    // There is an edge case for folders that have "." in the name. The default range for replacements is determined
    // by the "current word" but that doesn't allow "." in the string, so if you autocomplete "some." for a string
    // like "some.folder.name" you end up with "some.some.folder.name".
    const isPathCompletion = typedText.includes("/");
    const isPathWithPeriodInName = isPathCompletion && completionText.includes(".") && typedText.includes(".");
    if (isPathWithPeriodInName) {
      // The text in our sanitization step has already been filtered to only include the most specific path but
      // our context includes the full thing, so we need to determine the substring in the most specific path.
      // This is then used to figure out what we should actually insert.
      // example 1: context = "a/path/to/some." and text = "some.folder.name" should produce "folder.name"
      // example 2: context = "a/path/to/some.fo" and text = "some.folder.name" should still produce "folder.name"
      const completionContext = typedText.substr(typedText.lastIndexOf("/") + 1);
      if (completionText.startsWith(completionContext)) {
        // sanity check: the paths match
        return completionText.substr(completionContext.lastIndexOf(".") + 1);
      }
    }

    // If the typed text starts with magics % indicator, we need to inserts the delta between what the user 
    // typed versus what is recommended by the completion. Without this, there will be extra % insertions.
    // Example:
    // User types %%p then suggestion list will recommend %%python, if we now commit the item then the
    // final text in the editor becomes %%p%%python instead of %%python. This is why the tracking code
    // below is needed. This behavior is only specific to the magics % indicators as Monaco does not
    // handle % characters in their completion list well.
    return typedMagicPrefix ? completionText.replace(typedMagicPrefix, "") : completionText;
  }

  /**
   * Maps numbers to strings, such that if a>b numerically, f(a)>f(b) lexicograhically.
   * 1 -> "za", 26 -> "zz", 27 -> "zza", 28 -> "zzb", 52 -> "zzz", 53 ->"zzza"
   * @param order Number to be converted to a sorting-string. order >= 0.
   * @returns A string representing the order.
   */
  private getSortText(order: number): string {
    order++;
    const numCharacters = 26; // "z" - "a" + 1;
    const div = Math.floor(order / numCharacters);

    let sortText = "z";
    for (let i = 0; i < div; i++) {
      sortText += "z";
    }

    const remainder = order % numCharacters;
    if (remainder > 0) {
      sortText += String.fromCharCode(96 + remainder);
    }
    return sortText;
  }
}

const completionProvider = new CompletionItemProvider();
export { completionProvider };
