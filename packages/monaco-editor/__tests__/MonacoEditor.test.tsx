import * as React from "react";
import * as Monaco from "monaco-editor/esm/vs/editor/editor.api";

import ResizeObserver from "../src/polyfill/windowResizeEventObserver";
global.ResizeObserver = ResizeObserver;

import { default as MonacoEditor } from "../src/MonacoEditor";
import { mount } from "enzyme";

// Common Props required to instantiate MonacoEditor View, shared by all tests.
const monacoEditorCommonProps = {
  id: "foo",
  contentRef: "bar",
  editorType: "monaco",
  theme: "vs",
  value: "test_value",
  enableCompletion: true,
  language: "python",
  onCursorPositionChange: () => {}
};

describe("MonacoEditor component is rendering correctly", () => {
  it("Should render MonacoEditor component", () => {
    const editorWrapper = mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={false}
      />
    );
    expect(editorWrapper).not.toBeNull();
  });
});

// Setup items shared by all tests in this block
// Mock out the common API methods so that private function calls don't fail
const mockEditor = {
  onDidContentSizeChange: jest.fn(),
  onDidChangeModelContent: jest.fn(),
  onDidFocusEditorText: jest.fn(),
  onDidBlurEditorText: jest.fn(),
  onDidChangeCursorSelection: jest.fn(),
  onDidFocusEditorWidget: jest.fn(),
  onDidBlurEditorWidget: jest.fn(),
  onMouseMove: jest.fn(),
  updateOptions: jest.fn(),
  getValue: jest.fn(),
  setValue: jest.fn(),
  getConfiguration: jest.fn(),
  getContainerDomNode: jest.fn(() => ({ clientWidth: 100, clientHeight: 50 })),
  layout: jest.fn(),
  getModel: jest.fn(),
  getSelection: jest.fn(),
  focus: jest.fn(),
  hasTextFocus: jest.fn(),
  hasWidgetFocus: jest.fn(),
  addCommand: jest.fn(),
  changeViewZones: jest.fn()
};

const mockEditorModel = {
  setEOL: jest.fn(),
  updateOptions: jest.fn()
};
const mockCreateEditor = jest.fn().mockReturnValue(mockEditor);
Monaco.editor.create = mockCreateEditor;
Monaco.editor.createModel = jest.fn().mockReturnValue(mockEditorModel);
MonacoEditor.prototype.requestLayout = jest.fn();
MonacoEditor.prototype.registerDefaultCompletionProvider = jest.fn();
MonacoEditor.prototype.getLayoutDimension = jest.fn(() => ({ width: 300, height: 400 }));

describe("MonacoEditor default completion provider", () => {
  beforeAll(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  it("Should call registerDefaultCompletionProvider method when registerCompletionUsingDefault is set to true", () => {
    mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={true}
        enableCompletion={true}
        shouldRegisterDefaultCompletion={true}
      />
    );
    expect(mockCreateEditor).toHaveBeenCalledTimes(1);
    expect(MonacoEditor.prototype.registerDefaultCompletionProvider).toHaveBeenCalledTimes(1);
  });

  it("Should not call registerDefaultCompletionProvider method when registerCompletionUsingDefault is set to false", () => {
    mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={true}
        enableCompletion={true}
        shouldRegisterDefaultCompletion={false}
      />
    );
    expect(mockCreateEditor).toHaveBeenCalledTimes(1);
    expect(MonacoEditor.prototype.registerDefaultCompletionProvider).toHaveBeenCalledTimes(0);
  });
});

describe("MonacoEditor lifeCycle methods set up", () => {
  beforeAll(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  it("Should call requestLayout method before rendering editor", () => {
    mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={true}
      />
    );
    expect(mockCreateEditor).toHaveBeenCalledTimes(1);
    expect(MonacoEditor.prototype.requestLayout).toHaveBeenCalledTimes(1);
  });

  it("Should set editor's focus on render if editorFocused prop is set and editor text or widget does not have focus", () => {
    mockEditor.hasWidgetFocus = jest.fn().mockReturnValue(false);
    // hasWidgetFocus() would return false in the following case:
    // 1. The editor text and editor widget(s) both do not have focus
    // Since, neither an editor widget nor the editor text have focus, we explicitly set editor's focus.
    mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={true}
      />
    );
    expect(mockCreateEditor).toHaveBeenCalledTimes(1);
    expect(mockEditor.focus).toHaveBeenCalledTimes(1);
  });

  it("Should not set editor's focus on render if editorFocused prop is set but editor text or a widget already has focus", () => {
    mockEditor.hasWidgetFocus = jest.fn().mockReturnValue(true);
    // hasWidgetFocus() would return true in the following cases:
    // 1. Editor text has focus i.e. cursor blink
    // 2. An editor widget has focus i.e. context menu, command palette
    // In both the scenarios we want to preserve the editor focus state and not steal the focus from a widget
    mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={true}
      />
    );
    expect(mockCreateEditor).toHaveBeenCalledTimes(1);
    expect(mockEditor.focus).toHaveBeenCalledTimes(0);
  });

  it("Should not set editor's focus on render if editorFocused prop is false", () => {
    mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={false}
      />
    );
    expect(mockCreateEditor).toHaveBeenCalledTimes(1);
    expect(mockEditor.focus).toHaveBeenCalledTimes(0);
  });

  it("Should call editor setValue when value prop has changed on componentDidUpdate.", () => {
    mockEditor.setValue = jest.fn();
    const editorWrapper = mount(<MonacoEditor {...monacoEditorCommonProps} value="initial_value" />);
    editorWrapper.setProps({ value: "different_value" });

    // We expect setValue is called twice. First on componentDidMount and second on componentDidUpdate
    // when the props.value has new different value.
    expect(mockEditor.setValue).toHaveBeenCalledTimes(1);
  });

  it("Should not call editor setValue when value prop has not changed on componentDidUpdate.", () => {
    mockEditor.setValue = jest.fn();
    const editorWrapper = mount(<MonacoEditor {...monacoEditorCommonProps} value="initial_value" />);
    editorWrapper.setProps({ value: "initial_value" });

    // We expect setValue is called once on componentDidMount when the props.value does not have different value.
    expect(mockEditor.setValue).toHaveBeenCalledTimes(0);
  });

  it("Should call setEOL when creating editor", () => {
    mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={true}
      />
    );
    expect(Monaco.editor.createModel).toHaveBeenCalledTimes(1);
    expect(Monaco.editor.create).toHaveBeenCalledTimes(1);
    expect(mockEditorModel.setEOL).toHaveBeenCalledTimes(1);
  });
});

describe("MonacoEditor lineNumbers configuration", () => {
  beforeAll(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  it("Should set lineNumbers on editor when set in props", () => {
    mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={false}
        lineNumbers={true}
      />
    );
    expect(mockCreateEditor).toHaveBeenCalledTimes(1);
    // Get the second arg to Monaco.editor.create call
    const editorCreateArgs = mockCreateEditor.mock.calls[0][1];
    expect(editorCreateArgs).toHaveProperty("lineNumbers");
    expect(editorCreateArgs.lineNumbers).toEqual("on");
  });

  it("Should not set lineNumbers on editor when set to false in props", () => {
    mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={false}
        lineNumbers={false}
      />
    );
    expect(mockCreateEditor).toHaveBeenCalledTimes(1);
    // Get the second arg to Monaco.editor.create call
    const editorCreateArgs = mockCreateEditor.mock.calls[0][1];
    expect(editorCreateArgs).toHaveProperty("lineNumbers");
    expect(editorCreateArgs.lineNumbers).toEqual("off");
  });
});
