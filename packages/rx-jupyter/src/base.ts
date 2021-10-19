/** tslint:disable:jsdoc-format */
import Cookies from "js-cookie";
import { AjaxConfig, AjaxRequest } from "rxjs/ajax";
import { ServerConfig } from "@nteract/types";

export const normalizeBaseURL = (url = "") => url.replace(/\/+$/, "");

/**
 * Creates an AJAX request to connect to a given server. This function
 * handles setting the authorization tokens on the request.
 *
 * @param serverConfig Details about the server to connect to.
 * @param uri The URL to connect to, not including the base URL
 * @param opts A set of options to pass to the AJAX request. We mimic jquery.ajax support of a cache option here.
 *
 * @returns A fully-configured AJAX request for connecting to the server.
 */
export const createAJAXSettings = (
  serverConfig: ServerConfig,
  uri = "/",
  opts: Partial<AjaxRequest & { cache?: boolean }> = {}
): AjaxConfig => {
  const baseURL = normalizeBaseURL(serverConfig.endpoint || serverConfig.url);
  let url = `${baseURL}${uri}`;
  if (opts.cache === false) {
    const parsed = new URL(url);
    parsed.searchParams.set("_", Date.now().toString());
    url = parsed.href;
  }

  // Use the server config provided token if available before trying cookies
  const xsrfToken = serverConfig.xsrfToken || Cookies.get("_xsrf");
  const headers = {
    ...(xsrfToken && { "X-XSRFToken": xsrfToken }),
    ...(serverConfig.token && {
      Authorization: `token ${serverConfig.token}`
    })
  };

  // Merge in our typical settings for responseType, allow setting additional
  // options like the method
  const settings: AjaxConfig & Partial<ServerConfig> & { cache?: boolean } = {
    url,
    responseType: "json",
    createXHR: () => new XMLHttpRequest(),
    ...serverConfig,
    ...serverConfig.ajaxOptions,
    ...opts,
    // Make sure we merge in the auth headers with user given headers
    headers: {
      ...headers,
      ...opts.headers,
      ...(serverConfig.ajaxOptions && serverConfig.ajaxOptions.headers)
    }
  };
  delete settings.endpoint;
  delete settings.cache;
  return settings;
};
