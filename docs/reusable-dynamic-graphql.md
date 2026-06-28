# Reusable Dynamic GraphQL for LWC

Phase one provides a template-free JavaScript API module named `dynamicGraphql`. It builds dynamic Salesforce GraphQL queries and variables, extracts raw nodes, and converts UI API field responses into plain JavaScript records.

The module has no HTML and no presentation dependency. A card, chart, form, data table, or another LWC can import the same functions.

## Included components

- `dynamicGraphql`: Shared JavaScript API module.
- `dynamicGraphql` Jest tests: Query, variable, nested relationship, and result-transformation coverage.
- `graphqlProviderCardsDemo`: Example consumer that displays GraphQL results as cards.

## Why the consuming LWC still uses `@wire`

`lightning/graphql` is a wire adapter and requires LWC component context. A plain JavaScript module cannot execute the adapter itself. The shared module therefore owns query construction and result transformation, while each consumer keeps a minimal `@wire(graphql, ...)` boundary.

API 67 state managers cannot contain wire adapters, so moving `graphql` execution into a state manager does not remove this requirement.

## Configuration

Pass a JavaScript object or JSON string:

```js
const configuration = {
  objectApiName: "Contact",
  fields: ["Name", "Email", "Account.Name", "Account.Parent.Name"],
  where: {
    Account: {
      Industry: { eq: "Technology" }
    }
  },
  orderBy: {
    CreatedDate: { order: "DESC" }
  },
  recordLimit: 25
};
```

Object names, field selections, and filter structure become part of the generated GraphQL document. Filter values and the record limit are supplied through GraphQL variables.

## Use it from another LWC

```js
import { LightningElement, wire } from "lwc";
import { graphql } from "lightning/graphql";
import {
  createDynamicGraphqlQuery,
  createDynamicGraphqlVariables,
  extractDynamicGraphqlNodes,
  flattenDynamicGraphqlRecords
} from "c/dynamicGraphql";

export default class ContactCards extends LightningElement {
  configuration = {
    objectApiName: "Contact",
    fields: ["Name", "Email", "Account.Name"],
    where: {
      Account: { Industry: { eq: "Technology" } }
    },
    recordLimit: 10
  };

  records = [];
  rawNodes = [];
  errors = [];
  graphqlResult;

  get query() {
    return createDynamicGraphqlQuery(this.configuration);
  }

  get variables() {
    return createDynamicGraphqlVariables(this.configuration);
  }

  @wire(graphql, {
    query: "$query",
    variables: "$variables"
  })
  wiredGraphql(result) {
    this.graphqlResult = result;
    this.errors = result.errors || [];
    this.rawNodes = extractDynamicGraphqlNodes(
      result.data,
      this.configuration.objectApiName
    );
    this.records = flattenDynamicGraphqlRecords({
      data: result.data,
      objectApiName: this.configuration.objectApiName,
      fieldConfigs: this.configuration.fields
    });
  }

  async refresh() {
    if (typeof this.graphqlResult?.refresh === "function") {
      await this.graphqlResult.refresh();
    }
  }
}
```

For the example above, flattened records contain direct values such as `Name` and `Email`. Relationship fields receive stable generated keys such as `relationshipField2`. Consumers that need semantic keys can pass field configuration objects with explicit `dataKey` values:

```js
fields: [
  { apiName: "Name", dataKey: "contactName" },
  { apiName: "Account.Name", dataKey: "accountName" }
];
```

## Public functions

### `normalizeDynamicGraphqlConfiguration(configuration)`

Normalizes object aliases, comma-separated or array-based fields, JSON filter values, order-by values, and the record limit.

### `createDynamicGraphqlQuery(configuration)`

Creates the `gql` document, including direct fields and nested parent relationship selections up to five levels.

### `createDynamicGraphqlVariables(configuration)`

Returns the `first`, `where`, and optional `orderBy` variables for the generated query.

### `buildGraphqlFieldSelection(fields)`

Builds only the nested GraphQL field-selection text. Use this when another query builder needs the same field tree.

### `extractDynamicGraphqlNodes(data, objectApiName)`

Returns the raw `node` values from the UI API connection edges.

### `flattenDynamicGraphqlRecords(options)`

Converts UI API `{ value, displayValue }` fields and nested parent fields into plain JavaScript records.

## Security and validation responsibilities

- Never pass unrestricted user text as an object name or field list.
- Define an allowlist of supported objects and fields in the consuming feature.
- The module validates API-name syntax, but the server remains responsible for object access, field access, sharing, and GraphQL schema validation.
- Handle `errors` returned by the GraphQL wire adapter because dynamically referenced metadata does not receive static referential-integrity protection.
- Polymorphic relationships can require explicit inline fragments and are not generated automatically by this phase.

## Run the tests

```bash
npm install
npx sfdx-lwc-jest -- --runInBand \
  force-app/main/default/lwc/dynamicGraphql/__tests__/dynamicGraphql.test.js \
  force-app/main/default/lwc/graphqlProviderCardsDemo/__tests__/graphqlProviderCardsDemo.test.js
```

## Deploy

```bash
sf project deploy start \
  --source-dir force-app/main/default/lwc/dynamicGraphql \
  --source-dir force-app/main/default/lwc/graphqlProviderCardsDemo
```

The card demo is optional. Deploy only `dynamicGraphql` when another component already consumes the shared API.
