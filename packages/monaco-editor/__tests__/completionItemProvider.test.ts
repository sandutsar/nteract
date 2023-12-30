import { createMessage, JupyterMessage } from "@nteract/messaging";
import { Subject } from "rxjs";
import * as Monaco from "monaco-editor/esm/vs/editor/editor.api";
import { completionProvider } from "../src/completions/completionItemProvider";
import * as editorBase from "../src/editor-base";

// Setup items shared by all tests
// Create Editor Model and Position
const testModel = Monaco.editor.createModel("some test code", "python");
const testPos = new Monaco.Position(1, 3);

// Mock the completion Request method
const mockFn = jest.spyOn(editorBase, "completionRequest");

const mockCompletionRequest = createMessage("complete_request", {
  content: {
    code: "foo",
    cursor_pos: 2
  }
});

mockFn.mockReturnValue(mockCompletionRequest);
describe("Completions should not get trigerred when channels/messages are missing", () => {
  beforeAll(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  it("Should not return any suggestions when channels is undefined", (done) => {
    completionProvider.setChannels(undefined);

    completionProvider.provideCompletionItems(testModel, testPos).then((result) => {
      expect(result).toHaveProperty("suggestions");
      expect(result.suggestions).toHaveLength(0);
      done();
    });
  });

  it("Should not return any suggestions when channels is empty", (done) => {
    // Create an empty channel with no messages
    const channels = new Subject<JupyterMessage>();
    completionProvider.setChannels(channels);

    completionProvider.provideCompletionItems(testModel, testPos).then((result) => {
      expect(result).toHaveProperty("suggestions");
      expect(result.suggestions).toHaveLength(0);
      done();
    });
    channels.complete();
  });

  it("Should not return any suggestions when channels don't contain a complete_reply message", (done) => {
    const testMessage = createMessage("kernel_info_reply");

    const channels = new Subject<JupyterMessage>();
    completionProvider.setChannels(channels);

    completionProvider.provideCompletionItems(testModel, testPos).then((result) => {
      expect(result).toHaveProperty("suggestions");
      expect(result.suggestions).toHaveLength(0);
      done();
    });
    // No suggestions should be provided for incompatible message type
    channels.next(testMessage);
    channels.complete();
  });

  it("Should not return any suggestions when channels don't have the correct response message", (done) => {
    const testMessage = createMessage("complete_reply", {
      content: {
        status: "some_status",
        cursor_start: 3,
        cursor_end: 5,
        matches: ["some_completion"]
      }
    });

    const channels = new Subject<JupyterMessage>();
    completionProvider.setChannels(channels);

    completionProvider.provideCompletionItems(testModel, testPos).then((result) => {
      expect(result).toHaveProperty("suggestions");
      expect(result.suggestions).toHaveLength(0);
      done();
    });
    // Although we have a complete reply message, it is not the child of the appropriate complete_request message
    channels.next(testMessage);
    channels.complete();
  });
});

describe("Appropriate completions should be provided", () => {
  beforeAll(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  it("Should return a suggestion when channels contain a single reply with string match", (done) => {
    const mockCompleteReply = createMessage("complete_reply", {
      content: {
        status: "some_status",
        cursor_start: 3,
        cursor_end: 5,
        matches: ["some_completion"]
      },
      parent_header: mockCompletionRequest.header
    });

    const channels = new Subject<JupyterMessage>();
    completionProvider.setChannels(channels);
    completionProvider.provideCompletionItems(testModel, testPos).then((result) => {
      expect(result).toHaveProperty("suggestions");
      const returnedSuggestions = result.suggestions;
      expect(returnedSuggestions).toHaveLength(1);
      expect(returnedSuggestions[0].kind).toEqual(Monaco.languages.CompletionItemKind.Field);
      expect(returnedSuggestions[0].insertText).toEqual("some_completion");
      done();
    });
    // Set the reply message on channels and complete the stream
    channels.next(mockCompleteReply);
    channels.complete();
  });

  it("Should return all suggestions from the received matches", (done) => {
    const mockCompleteReply = createMessage("complete_reply", {
      content: {
        status: "some_status",
        cursor_start: 3,
        cursor_end: 5,
        matches: ["completion1", "completion2"]
      },
      parent_header: mockCompletionRequest.header
    });

    const channels = new Subject<JupyterMessage>();
    completionProvider.setChannels(channels);
    completionProvider.provideCompletionItems(testModel, testPos).then((result) => {
      expect(result).toHaveProperty("suggestions");
      const returnedSuggestions = result.suggestions;
      expect(returnedSuggestions).toHaveLength(2);
      expect(returnedSuggestions[0].kind).toEqual(Monaco.languages.CompletionItemKind.Field);
      expect(returnedSuggestions[0].insertText).toEqual("completion1");
      expect(returnedSuggestions[1].kind).toEqual(Monaco.languages.CompletionItemKind.Field);
      expect(returnedSuggestions[1].insertText).toEqual("completion2");
      done();
    });
    // Set the reply message on channels and complete the stream
    channels.next(mockCompleteReply);
    channels.complete();
  });

  it("Should return a suggestion when channels contain a single reply with a completionItem match", (done) => {
    const mockCompleteReply = createMessage("complete_reply", {
      content: {
        status: "some_status",
        cursor_start: 3,
        cursor_end: 5,
        matches: [
          {
            end: 5,
            start: 3,
            type: "keyword",
            text: "some_completion"
          }
        ]
      },
      parent_header: mockCompletionRequest.header
    });

    const channels = new Subject<JupyterMessage>();
    completionProvider.setChannels(channels);
    completionProvider.provideCompletionItems(testModel, testPos).then((result) => {
      expect(result).toHaveProperty("suggestions");
      const returnedSuggestions = result.suggestions;
      expect(returnedSuggestions).toHaveLength(1);
      expect(returnedSuggestions[0].kind).toEqual(Monaco.languages.CompletionItemKind.Keyword);
      expect(returnedSuggestions[0].insertText).toEqual("some_completion");
      done();
    });
    // Set the reply message on channels and complete the stream
    channels.next(mockCompleteReply);
    channels.complete();
  });

  it("Should return suggestions when matches received in _jupyter_types_experimental metadata property", (done) => {
    const mockCompleteReply = createMessage("complete_reply", {
      content: {
        status: "some_status",
        cursor_start: 3,
        cursor_end: 5,
        metadata: {
          _jupyter_types_experimental: ["some_completion"]
        }
      },
      parent_header: mockCompletionRequest.header
    });

    const channels = new Subject<JupyterMessage>();
    completionProvider.setChannels(channels);
    completionProvider.provideCompletionItems(testModel, testPos).then((result) => {
      expect(result).toHaveProperty("suggestions");
      const returnedSuggestions = result.suggestions;
      expect(returnedSuggestions).toHaveLength(1);
      expect(returnedSuggestions[0].kind).toEqual(Monaco.languages.CompletionItemKind.Field);
      expect(returnedSuggestions[0].insertText).toEqual("some_completion");
      done();
    });
    // Set the reply message on channels and complete the stream
    channels.next(mockCompleteReply);
    channels.complete();
  });

  it("Should return suggestions with content after any last dots", (done) => {
    const mockCompleteReply = createMessage("complete_reply", {
      content: {
        status: "some_status",
        cursor_start: 3,
        cursor_end: 5,
        matches: ["completion1.itemA.itemB", "completion2.itemC"]
      },
      parent_header: mockCompletionRequest.header
    });

    const channels = new Subject<JupyterMessage>();
    completionProvider.setChannels(channels);
    completionProvider.provideCompletionItems(testModel, testPos).then((result) => {
      expect(result).toHaveProperty("suggestions");
      const returnedSuggestions = result.suggestions;
      expect(returnedSuggestions).toHaveLength(2);
      expect(returnedSuggestions[0].kind).toEqual(Monaco.languages.CompletionItemKind.Field);
      expect(returnedSuggestions[0].label).toEqual("itemB");
      expect(returnedSuggestions[0].insertText).toEqual("itemB");
      expect(returnedSuggestions[1].kind).toEqual(Monaco.languages.CompletionItemKind.Field);
      expect(returnedSuggestions[1].label).toEqual("itemC");
      expect(returnedSuggestions[1].insertText).toEqual("itemC");
      done();
    });
    // Set the reply message on channels and complete the stream
    channels.next(mockCompleteReply);
    channels.complete();
  });
  
  it("Should return suggestions containing cell and line magics when position is at start of cell", (done) => {
    const model = Monaco.editor.createModel("%m", "python");
    const position = new Monaco.Position(1, 3);
    const mockCompleteReply = createMessage("complete_reply", {
      content: {
        status: "some_status",
        cursor_start: 0,
        cursor_end: 2,
        matches: ["%%magic1", "%magic2"]
      },
      parent_header: mockCompletionRequest.header
    });

    const channels = new Subject<JupyterMessage>();
    completionProvider.setChannels(channels);
    completionProvider.provideCompletionItems(model, position).then((result) => {
      expect(result).toHaveProperty("suggestions");
      const returnedSuggestions = result.suggestions;
      expect(returnedSuggestions).toHaveLength(2);
      expect(returnedSuggestions[0].label).toEqual("%%magic1");
      expect(returnedSuggestions[1].label).toEqual("%magic2");
      done();
    });
    // Set the reply message on channels and complete the stream
    channels.next(mockCompleteReply);
    channels.complete();
  });

  it("Should return suggestions containing cell and line magics when position is at start of 2nd line with blank 1st line", (done) => {
    const model = Monaco.editor.createModel("\n%m", "python");
    const position = new Monaco.Position(2, 4);
    const mockCompleteReply = createMessage("complete_reply", {
      content: {
        status: "some_status",
        cursor_start: 1,
        cursor_end: 3,
        matches: ["%%magic1", "%magic2"]
      },
      parent_header: mockCompletionRequest.header
    });

    const channels = new Subject<JupyterMessage>();
    completionProvider.setChannels(channels);
    completionProvider.provideCompletionItems(model, position).then((result) => {
      expect(result).toHaveProperty("suggestions");
      const returnedSuggestions = result.suggestions;
      expect(returnedSuggestions).toHaveLength(2);
      expect(returnedSuggestions[0].label).toEqual("%%magic1");
      expect(returnedSuggestions[1].label).toEqual("%magic2");
      done();
    });
    // Set the reply message on channels and complete the stream
    channels.next(mockCompleteReply);
    channels.complete();
  });

  it("Should return suggestions containing line magic when position is at start of 2nd line with non-blank 1st line", (done) => {
    const model = Monaco.editor.createModel("print()\n%m", "python");
    const position = new Monaco.Position(9, 11);
    const mockCompleteReply = createMessage("complete_reply", {
      content: {
        status: "some_status",
        cursor_start: 8,
        cursor_end: 10,
        matches: ["%%magic1", "%magic2"]
      },
      parent_header: mockCompletionRequest.header
    });

    const channels = new Subject<JupyterMessage>();
    completionProvider.setChannels(channels);
    completionProvider.provideCompletionItems(model, position).then((result) => {
      expect(result).toHaveProperty("suggestions");
      const returnedSuggestions = result.suggestions;
      expect(returnedSuggestions).toHaveLength(1);
      expect(returnedSuggestions[0].label).toEqual("%magic2");
      done();
    });
    // Set the reply message on channels and complete the stream
    channels.next(mockCompleteReply);
    channels.complete();
  });

  it("Should return suggestions not containing cell and line magics when content before position contains non-whitespace characters", (done) => {
    const model = Monaco.editor.createModel("print() %m", "python");
    const position = new Monaco.Position(9, 11);
    const mockCompleteReply = createMessage("complete_reply", {
      content: {
        status: "some_status",
        cursor_start: 8,
        cursor_end: 10,
        matches: ["%%magic1", "%magic2"]
      },
      parent_header: mockCompletionRequest.header
    });

    const channels = new Subject<JupyterMessage>();
    completionProvider.setChannels(channels);
    completionProvider.provideCompletionItems(model, position).then((result) => {
      expect(result).toHaveProperty("suggestions");
      const returnedSuggestions = result.suggestions;
      expect(returnedSuggestions).toHaveLength(0);
      done();
    });
    // Set the reply message on channels and complete the stream
    channels.next(mockCompleteReply);
    channels.complete();
  });
});
