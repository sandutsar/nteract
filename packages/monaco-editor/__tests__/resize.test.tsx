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
MonacoEditor.prototype.registerDefaultCompletionProvider = jest.fn();
MonacoEditor.prototype.getLayoutDimension = jest.fn(() => ({ width: 300, height: 400 }));

describe("MonacoEditor resize handler when window size changes", () => {
  beforeAll(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("Should not call resize handler at all when window is not resized", async () => {
    // Create a new editor instance with the mock layout
    const mockEditorLayout = jest.fn();
    const newMockEditor = { ...mockEditor };
    newMockEditor.layout = mockEditorLayout;
    mockCreateEditor.mockReturnValue(newMockEditor);
    // We spy on the resize handler calls without changing the implementation
    const resizeHandlerSpy = jest.spyOn(MonacoEditor.prototype, "onResize");

    mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={false}
      />
    );

    await new Promise(window.requestAnimationFrame);
    expect(mockEditorLayout).toHaveBeenCalledTimes(1);

    expect(mockCreateEditor).toHaveBeenCalledTimes(1);
    // Resize handler should be called
    expect(resizeHandlerSpy).toHaveBeenCalledTimes(0);

    // Restore spy
    resizeHandlerSpy.mockRestore();
  });

  it("Resize handler should not trigger editor.layout when it is not focused", async () => {
    // This is a perf optimization to reduce layout calls for unfocussed editors

    // Create a new editor instance with the mock layout
    const mockEditorLayout = jest.fn();
    const newMockEditor = { ...mockEditor };
    newMockEditor.layout = mockEditorLayout;
    mockCreateEditor.mockReturnValue(newMockEditor);
    // We spy on the resize handler calls without changing the implementation
    const resizeHandlerSpy = jest.spyOn(MonacoEditor.prototype, "onResize");

    mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={false}
      />
    );

    await new Promise(window.requestAnimationFrame);
    expect(mockEditorLayout).toHaveBeenCalledTimes(1);

    (window as any).innerWidth = 500;
    window.dispatchEvent(new Event("resize"));

    // Resize handler should be called
    expect(resizeHandlerSpy).toHaveBeenCalledTimes(1);
    // editor.layout should not be called
    expect(mockEditorLayout).toHaveBeenCalledTimes(1);

    // Restore spy
    resizeHandlerSpy.mockRestore();
  });

  it("Resize handler should trigger an editor.layout call for a focused editor", async () => {
    // Create a new editor instance with the mock layout
    const mockEditorLayout = jest.fn();
    const newMockEditor = { ...mockEditor };
    newMockEditor.layout = mockEditorLayout;
    mockCreateEditor.mockReturnValue(newMockEditor);
    // We spy on the resize handler calls without changing the implementation
    const resizeHandlerSpy = jest.spyOn(MonacoEditor.prototype, "onResize");

    mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={true}
      />
    );

    await new Promise(window.requestAnimationFrame);
    expect(mockEditorLayout).toHaveBeenCalledTimes(1);

    (window as any).innerWidth = 500;
    window.dispatchEvent(new Event("resize"));

    expect(resizeHandlerSpy).toHaveBeenCalledTimes(1);
    expect(mockEditorLayout).toHaveBeenCalledTimes(2);

    // Restore spy
    resizeHandlerSpy.mockRestore();
  });

  it("Resize handler should trigger an editor.layout call for a non-focused editor when shouldUpdateLayoutWhenNotFocused=true", async () => {
    // Create a new editor instance with the mock layout
    const mockEditorLayout = jest.fn();
    const newMockEditor = { ...mockEditor };
    newMockEditor.layout = mockEditorLayout;
    mockCreateEditor.mockReturnValue(newMockEditor);

    const wrapper = mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={false}
        shouldUpdateLayoutWhenNotFocused={true}
      />
    );

    await new Promise(window.requestAnimationFrame);
    expect(mockEditorLayout).toHaveBeenCalledTimes(1);

    const componentInstance = wrapper.instance() as MonacoEditor;
    // We spy on the resize handler calls without changing the implementation
    const resizeHandlerSpy = jest.spyOn(componentInstance, "onResize");

    (window as any).innerWidth = 500;
    window.dispatchEvent(new Event("resize"));

    expect(resizeHandlerSpy).toHaveBeenCalledTimes(1);
    expect(mockEditorLayout).toHaveBeenCalledTimes(2);

    // Restore spy
    resizeHandlerSpy.mockRestore();
  });

  it("Resize handler should trigger an editor.layout call asynchronously when batchLayoutChanges=true", async () => {
    // Create a new editor instance with the mock layout
    const mockEditorLayout = jest.fn();
    const newMockEditor = { ...mockEditor };
    newMockEditor.layout = mockEditorLayout;
    mockCreateEditor.mockReturnValue(newMockEditor);
    const originRAF = window.requestAnimationFrame;
    const mockRAF = jest.fn((callback) => originRAF(callback));
    window.requestAnimationFrame = mockRAF;

    const wrapper = mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={true}
        batchLayoutChanges={true}
      />
    );

    const componentInstance = wrapper.instance() as MonacoEditor;
    // We spy on the resize handler calls without changing the implementation
    const resizeHandlerSpy = jest.spyOn(componentInstance, "onResize");

    (window as any).innerWidth = 500;
    window.dispatchEvent(new Event("resize"));

    expect(resizeHandlerSpy).toHaveBeenCalledTimes(1);
    expect(mockEditorLayout).toHaveBeenCalledTimes(0);

    expect(mockRAF).toHaveBeenCalledTimes(1);

    // wait on the second RAF to returned, which should be called after the first RAF has been executed
    await new Promise(originRAF);
    expect(mockEditorLayout).toHaveBeenCalledTimes(1);

    // Restore spy
    resizeHandlerSpy.mockRestore();
  });

  it("Resize handler should trigger an editor.layout call when skipLayoutWhenHidden=true and parent container is NOT hidden", async () => {
    // Create a new editor instance with the mock layout
    const mockEditorLayout = jest.fn();
    const newMockEditor = { ...mockEditor };
    newMockEditor.layout = mockEditorLayout;
    mockCreateEditor.mockReturnValue(newMockEditor);

    const wrapper = mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={true}
        skipLayoutWhenHidden={true}
      />
    );

    await new Promise(window.requestAnimationFrame);
    const componentInstance = wrapper.instance() as MonacoEditor;

    // We spy on the resize handler calls without changing the implementation
    const resizeHandlerSpy = jest.spyOn(componentInstance, "onResize");
    componentInstance.isContainerHidden = jest.fn(() => false);

    (window as any).innerWidth = 500;
    window.dispatchEvent(new Event("resize"));

    expect(resizeHandlerSpy).toHaveBeenCalledTimes(1);
    expect(mockEditorLayout).toHaveBeenCalledTimes(1);

    // Restore spy
    resizeHandlerSpy.mockRestore();
  });

  it("Resize handler should NOT trigger an editor.layout call when skipLayoutWhenHidden=true and parent container is hidden", async () => {
    // Create a new editor instance with the mock layout
    const mockEditorLayout = jest.fn();
    const newMockEditor = { ...mockEditor };
    newMockEditor.layout = mockEditorLayout;
    mockCreateEditor.mockReturnValue(newMockEditor);

    const wrapper = mount(
      <MonacoEditor
        {...monacoEditorCommonProps}
        channels={undefined}
        onChange={jest.fn()}
        onFocusChange={jest.fn()}
        editorFocused={true}
        skipLayoutWhenHidden={true}
      />
    );

    await new Promise(window.requestAnimationFrame);

    const componentInstance = wrapper.instance() as MonacoEditor;

    // We spy on the resize handler calls without changing the implementation
    const resizeHandlerSpy = jest.spyOn(componentInstance, "onResize");
    componentInstance.isContainerHidden = jest.fn(() => true);

    (window as any).innerWidth = 500;
    window.dispatchEvent(new Event("resize"));

    expect(resizeHandlerSpy).toHaveBeenCalledTimes(1);
    expect(mockEditorLayout).toHaveBeenCalledTimes(0);

    // Restore spy
    resizeHandlerSpy.mockRestore();
  });
});
