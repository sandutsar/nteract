import { Observable } from "rxjs";
import { ajax, AjaxResponse } from "rxjs/ajax";
import { ServerConfig } from "@nteract/types";
import { createAJAXSettings } from "./base";
import { KernelResponse } from "./kernels";

export interface KernelSpecFileResponse
{
  language: string;
  argv: string[];
  display_name: string;
  codemirror_mode: string;
  env: { [name: string] : any };
  metadata: { [name: string] : any };
  interrupt_mode?: string | undefined;
}

export interface KernelspecResponse 
{
  name: string;
  resources: { [name: string] : any };
  spec: KernelSpecFileResponse;

}

export interface ListKernelspecsResponse
{
  default: string;
  kernelspecs: { [name: string] : KernelspecResponse };
}

/**
 * Creates an AjaxObservable for listing available kernelspecs.
 *
 * @param serverConfig The server configuration
 *
 * @return An Observable with the request response
 */
export const list = (serverConfig: ServerConfig) =>
  ajax<ListKernelspecsResponse>(createAJAXSettings(serverConfig, "/api/kernelspecs", { cache: false }));

/**
 * Returns the specification of available kernels with the given
 * kernel name.
 *
 * @param serverConfig The server configuration
 * @param name The name of the kernel
 *
 * @returns An Observable with the request response
 */
export const get = (
  serverConfig: ServerConfig,
  name: string
) =>
  ajax<KernelspecResponse>(
    createAJAXSettings(serverConfig, `/api/kernelspecs/${name}`, {
      cache: false
    })
  );
