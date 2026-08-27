import { createTestWireAdapter } from "@salesforce/wire-service-jest-util";

export class graphql extends createTestWireAdapter() {
  static emit(value, filterFn) {
    super.emit({ data: value, errors: undefined }, filterFn);
  }

  static emitErrors(errors, filterFn) {
    super.emit({ data: undefined, errors }, filterFn);
  }

  constructor(dataCallback) {
    super(dataCallback);
    graphql.emit(undefined);
  }
}

export const gql = jest.fn((strings, ...values) =>
  strings.reduce(
    (query, queryPart, index) => `${query}${queryPart}${values[index] || ""}`,
    ""
  )
);
