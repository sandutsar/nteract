import Immutable from "immutable";
import React from "react";
import { connect } from "react-redux";

import { AppState, ContentRef, selectors } from "@nteract/core";
import { RichMedia } from "@nteract/outputs";

interface ComponentProps {
  id: string;
  contentRef: ContentRef;
  children: React.ReactNode;
}

interface StateProps {
  pagers: Immutable.List<any>;
}

export class Pagers extends React.PureComponent<ComponentProps & StateProps> {
  render() {
    const { pagers } = this.props;
    return (
      <div className="nteract-cell-pagers">
        {pagers.map(pager => (
          <RichMedia data={pager} metadata={{}}>
            {React.Children.map(this.props.children, child => {
              if (
                typeof child === "string" ||
                typeof child === "number" ||
                typeof child === "boolean"
              ) {
                return;
              }
              if (!child || typeof child !== "object" || !("props" in child)) {
                return;
              }
              return React.cloneElement(child, this.props);
            })}
          </RichMedia>
        ))}
      </div>
    );
  }
}

export const makeMapStateToProps = (
  initialState: AppState,
  ownProps: ComponentProps
): ((state: AppState) => StateProps) => {
  const mapStateToProps = (state: AppState): StateProps => {
    let pagers = Immutable.List();

    const { contentRef, id } = ownProps;
    const model = selectors.model(state, { contentRef });

    if (model && model.type === "notebook") {
      const cell = selectors.notebook.cellById(model, { id });
      if (cell) {
        pagers = model.getIn(["cellPagers", id]) || Immutable.List();
      }
    }

    return { pagers };
  };
  return mapStateToProps;
};

export default connect<StateProps, void, ComponentProps, AppState>(
  makeMapStateToProps
)(Pagers);
