import {
  buildGraphqlFieldSelection,
  createDynamicGraphqlQuery,
  createDynamicGraphqlVariables,
  extractDynamicGraphqlNodes,
  flattenDynamicGraphqlRecords,
  normalizeDynamicGraphqlConfiguration
} from "c/dynamicGraphql";

describe("c/dynamicGraphql API module", () => {
  const configuration = {
    objectApiName: "Contact",
    fields: ["Name", "Account.Name", "Account.Parent.Name"],
    where: { Account: { Industry: { eq: "Electronics" } } },
    recordLimit: 25,
    orderBy: { CreatedDate: { order: "DESC" } }
  };

  it("builds a nested dynamic query and variables", () => {
    const query = createDynamicGraphqlQuery(configuration);

    expect(query).toContain("$where: Contact_Filter");
    expect(query).toContain("$orderBy: Contact_OrderBy");
    expect(query).toContain("Account {");
    expect(query).toContain("Parent {");
    expect(createDynamicGraphqlVariables(configuration)).toEqual({
      first: 25,
      where: configuration.where,
      orderBy: configuration.orderBy
    });
  });

  it("normalizes JSON strings and comma-separated fields", () => {
    const normalized = normalizeDynamicGraphqlConfiguration(
      JSON.stringify({
        objectApiName: "Account",
        fields: "Name,Industry",
        where: { Industry: { eq: "Technology" } },
        limit: 500
      })
    );

    expect(normalized.fields.map((field) => field.apiName)).toEqual([
      "Name",
      "Industry"
    ]);
    expect(normalized.recordLimit).toBe(200);
  });

  it("flattens direct and nested values while preserving raw nodes", () => {
    const data = {
      uiapi: {
        query: {
          Contact: {
            edges: [
              {
                node: {
                  Id: "003000000000001",
                  Name: { value: "Rose", displayValue: null },
                  Account: {
                    Name: { value: "Edge", displayValue: null },
                    Parent: null
                  }
                }
              }
            ]
          }
        }
      }
    };
    const fieldConfigs =
      normalizeDynamicGraphqlConfiguration(configuration).fields;

    expect(extractDynamicGraphqlNodes(data, "Contact")).toHaveLength(1);
    expect(
      flattenDynamicGraphqlRecords({
        data,
        objectApiName: "Contact",
        fieldConfigs
      })
    ).toEqual([
      {
        Id: "003000000000001",
        Name: "Rose",
        relationshipField1: "Edge",
        relationshipField2: ""
      }
    ]);
    expect(buildGraphqlFieldSelection(fieldConfigs)).toContain("Parent {");
  });
});
