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
  layout: jest.fn(),
  getModel: jest.fn(),
  getSelection: jest.fn(),
  getContentHeight: jest.fn(),
  getContainerDomNode: jest.fn(),
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
MonacoEditor.prototype.registerDefaultCompletionProvider = jest.fn();

describe("MonacoEditor process layout correctly", () => {
  beforeAll(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("maxContentHeight is honored when content height exceeds it", async () => {
    // Create a new editor instance with the mock layout
    const mockEditorLayout = jest.fn();
    const width = 500;
    const height = 100;
    const maxHeight = 200;
    const contentHeight = 300;
    const newMockEditor = {
      ...mockEditor,
      layout: mockEditorLayout,
      getContentHeight: () => contentHeight,
      getContainerDomNode: () => ({ clientWidth: width, clientHeight: height }),
      getLayoutInfo: jest.fn(() => ({ width, height }))
    };

    mockCreateEditor.mockReturnValue(newMockEditor);
    const editorWrapper = mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={true}
        maxContentHeight={maxHeight}
      />
    );

    await new Promise(window.requestAnimationFrame);
    expect(mockEditorLayout).toHaveBeenCalledTimes(1);

    const editorInstance = editorWrapper.instance() as MonacoEditor;
    editorInstance.requestLayout();

    expect(mockEditorLayout).toHaveBeenCalledTimes(2);
    expect(mockEditorLayout.mock.calls[0][0]).toEqual({ width, height: maxHeight });
  });

  it("should use the previous clientHeight when autoFitContentHeight is false", () => {
    // Create a new editor instance with the mock layout
    const mockEditorLayout = jest.fn();
    const getContentHeight = jest.fn();
    getContentHeight.mockReturnValue(100);

    const newMockEditor = {
      ...mockEditor,
      layout: mockEditorLayout,
      getContentHeight,
      getContainerDomNode: jest.fn(() => ({ clientHeight: 50, clientWidth: 100 }))
    };

    mockCreateEditor.mockReturnValue(newMockEditor);
    const props = {
      ...monacoEditorCommonProps,
      channels: undefined,
      onChange: jest.fn(),
      onFocusChange: jest.fn(),
      editorFocused: true,
      autoFitContentHeight: false
    };

    const editorWrapper = mount(<MonacoEditor {...props} />);
    expect(mockEditorLayout).toHaveBeenCalledTimes(1);
    expect(mockEditorLayout).toHaveBeenCalledWith({ height: 50, width: 100 });

    getContentHeight.mockReturnValue(200);
    editorWrapper.setProps({ value: "test\nsecond line" });

    expect(mockEditorLayout).toHaveBeenCalledTimes(1);
    expect(mockEditorLayout).toHaveBeenCalledWith({ height: 50, width: 100 });
  });

  it("should NOT trigger layout when skipLayoutWhenHidden is true and parent container is hidden", () => {
    // Create a new editor instance with the mock layout
    const mockEditorLayout = jest.fn();
    const newMockEditor = {
      ...mockEditor,
      layout: mockEditorLayout,
      getContentHeight: jest.fn(() => 100),
      getLayoutInfo: jest.fn(() => ({ width: 100, height: 100 }))
    };

    mockCreateEditor.mockReturnValue(newMockEditor);
    const editorWrapper = mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={true}
        skipLayoutWhenHidden={true}
      />
    );

    const editorInstance = editorWrapper.instance() as MonacoEditor;
    editorInstance.isContainerHidden = jest.fn(() => true);

    // set an arbitary height which is different from the current height return by editor.getContentHeight()
    editorInstance.requestLayout();
    expect(mockEditorLayout).toHaveBeenCalledTimes(0);
  });

  it("should trigger layout when skipLayoutWhenHidden is true and parent container is NOT hidden", () => {
    // Create a new editor instance with the mock layout
    const mockEditorLayout = jest.fn();
    const newMockEditor = {
      ...mockEditor,
      layout: mockEditorLayout,
      getContentHeight: jest.fn(() => 100),
      getContainerDomNode: jest.fn(() => ({ clientHeight: 50, clientWidth: 100 })),
      getLayoutInfo: jest.fn(() => ({ width: 100, height: 100 }))
    };

    mockCreateEditor.mockReturnValue(newMockEditor);
    const editorWrapper = mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={true}
        skipLayoutWhenHidden={true}
      />
    );

    const editorInstance = editorWrapper.instance() as MonacoEditor;
    editorInstance.isContainerHidden = jest.fn(() => false);

    // set an arbitary height which is different from the current height return by editor.getContentHeight()
    editorInstance.requestLayout();
    expect(mockEditorLayout).toHaveBeenCalledTimes(1);
  });
});
