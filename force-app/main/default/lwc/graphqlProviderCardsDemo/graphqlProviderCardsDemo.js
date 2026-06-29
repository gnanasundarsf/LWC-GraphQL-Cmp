import { LightningElement, wire } from "lwc";
import { graphql } from "lightning/graphql";
import {
  createDynamicGraphqlQuery,
  createDynamicGraphqlVariables,
  flattenDynamicGraphqlRecords
} from "c/dynamicGraphql";

export default class GraphqlProviderCardsDemo extends LightningElement {
  configuration = {
    objectApiName: "Account",
    fields: ["Name", "Industry", "AnnualRevenue"],
    where: { Industry: { eq: "Technology" } },
    orderBy: { Name: { order: "ASC" } },
    recordLimit: 10
  };

  query = createDynamicGraphqlQuery(this.configuration);
  variables = createDynamicGraphqlVariables(this.configuration);
  result = { records: [], errors: [], loading: true };
  graphqlResult;

  @wire(graphql, { query: "$query", variables: "$variables" })
  wiredGraphql(result) {
    this.graphqlResult = result;
    this.result = {
      records: result.data
        ? flattenDynamicGraphqlRecords({
            data: result.data,
            objectApiName: this.configuration.objectApiName,
            fieldConfigs: this.configuration.fields
          })
        : [],
      errors: (result.errors || []).map((error, index) => ({
        key: `graphql-${index}`,
        message: error.message || String(error)
      })),
      loading: !result.data && !result.errors
    };
  }

  async refresh() {
    if (typeof this.graphqlResult?.refresh === "function") {
      await this.graphqlResult.refresh();
    }
  }

  get loading() {
    return this.result.loading;
  }

  get hasErrors() {
    return this.result.errors.length > 0;
  }

  get errorMessage() {
    return this.result.errors.map((error) => error.message).join("; ");
  }

  get accountCards() {
    return this.result.records;
  }

  get hasRecords() {
    return !this.loading && !this.hasErrors && this.accountCards.length > 0;
  }
}
