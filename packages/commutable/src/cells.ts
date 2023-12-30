import { ImmutableOutput } from "./outputs";

import { ExecutionCount, MimeBundle, normalizeLineEndings } from "./primitives";

import {
  List as ImmutableList,
  Map as ImmutableMap,
  Record,
  RecordOf,
} from "immutable";

function normalizedSourceCellRecord<T extends { source?: string }>(recordFn: Record.Factory<T>): Record.Factory<T> {
  // Transparently wrap the factory, but overwrite the source with its normalized value
  function factory(this: ThisType<typeof recordFn>, ...args: Parameters<typeof recordFn>) {
    const res = recordFn.apply(this, args);
    return res.set("source", normalizeLineEndings(res.source));
  };
  factory.prototype = recordFn.prototype;
  factory.displayName = recordFn.displayName;
  return factory as Record.Factory<T>;
}

/* CodeCell Record Boilerplate */

export interface CodeCellParams {
  cell_type: "code";
  id?: string;
  // Sadly untyped and widely unspecced
  metadata: ImmutableMap<string, any>;
  execution_count: ExecutionCount;
  source: string;
  outputs: ImmutableList<ImmutableOutput>;
}

export const makeCodeCell = normalizedSourceCellRecord(Record<CodeCellParams>({
  cell_type: "code",
  execution_count: null,
  metadata: ImmutableMap({
    jupyter: ImmutableMap({
      source_hidden: false,
      outputs_hidden: false,
    }),
    nteract: ImmutableMap({
      transient: ImmutableMap({
        deleting: false,
      }),
    }),
  }),
  source: "",
  outputs: ImmutableList(),
}));

export type ImmutableCodeCell = RecordOf<CodeCellParams>;

/* MarkdownCell Record Boilerplate */

export interface MarkdownCellParams {
  attachments?: ImmutableMap<string, MimeBundle<string>>;
  cell_type: "markdown";
  id?: string;
  source: string;
  metadata: ImmutableMap<string, any>;
}

export const makeMarkdownCell = normalizedSourceCellRecord(Record<MarkdownCellParams>({
  attachments: undefined,
  cell_type: "markdown",
  metadata: ImmutableMap({
    nteract: ImmutableMap({
      transient: ImmutableMap({
        deleting: false,
      }),
    }),
  }),
  source: "",
}));

export type ImmutableMarkdownCell = RecordOf<MarkdownCellParams>;

/* RawCell Record Boilerplate */

export interface RawCellParams {
  id?: string;
  cell_type: "raw";
  source: string;
  metadata: ImmutableMap<string, any>;
}

export const makeRawCell = normalizedSourceCellRecord(Record<RawCellParams>({
  cell_type: "raw",
  metadata: ImmutableMap({
    nteract: ImmutableMap({
      transient: ImmutableMap({
        deleting: false,
      }),
    }),
  }),
  source: "",
}));

export type ImmutableRawCell = RecordOf<RawCellParams>;

export type ImmutableCell =
  | ImmutableMarkdownCell
  | ImmutableCodeCell
  | ImmutableRawCell;

export type CellType = "raw" | "markdown" | "code";
