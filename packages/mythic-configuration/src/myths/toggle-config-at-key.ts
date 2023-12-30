import findIndex from "lodash/findIndex";
import { of } from "rxjs";
import { configOption } from "../index";
import { configuration } from "../package";
import { setConfigAtKey } from "./set-config-at-key";

export const toggleConfigAtKey = configuration.createMyth("toggleConfigAtKey")<{
  key: string;
}>({
  thenDispatch: [
    (action, state) => {
      const values = configOption(action.payload.key).values!;
      const value = state.getIn(["current", ...action.payload.key.split(".")]);
      const index = findIndex(values, { value });

      return of(setConfigAtKey.create({
        key: action.payload.key,
        value: values[(index + 1) % values.length].value,
      }))
    },
  ],
});
