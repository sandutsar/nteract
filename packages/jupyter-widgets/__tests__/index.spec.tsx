import * as React from "react";

import WidgetDisplay from "../src/index";

describe("WidgetDisplay", () => {
  it("can be rendered", () => {
    const data = {
      model_id: "someModeId",
      version_major: 2,
      version_minor: 0
    };
    const model = {
      _dom_classes: [],
      _model_module: "@jupyter-widgets/controls",
      _model_module_version: "1.5.0",
      _model_name: "IntSliderModel",
      _view_count: null,
      _view_module: "@jupyter-widgets/controls",
      _view_module_version: "1.5.0",
      _view_name: "IntSliderView",
      continuous_update: false,
      description: "Test:",
      description_tooltip: null,
      disabled: false,
      layout: "IPY_MODEL_db277618a5c443009a6aa5b07f6b1812",
      max: 10,
      min: 0,
      orientation: "horizontal",
      readout: true,
      readout_format: "d",
      step: 1,
      style: "IPY_MODEL_2e810dab21354e9381f53582e51e9a79",
      value: 7
    };
    expect(<WidgetDisplay data={data} model={model} />).not.toBeNull();
  });
});
