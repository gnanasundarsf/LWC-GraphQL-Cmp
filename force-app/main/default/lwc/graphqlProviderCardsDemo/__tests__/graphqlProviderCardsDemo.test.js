import { createElement } from "lwc";
import GraphqlProviderCardsDemo from "c/graphqlProviderCardsDemo";
import { graphql } from "lightning/graphql";

describe("c-graphql-provider-cards-demo", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("renders provider records as cards rather than a datatable", async () => {
    const element = createElement("c-graphql-provider-cards-demo", {
      is: GraphqlProviderCardsDemo
    });
    document.body.appendChild(element);
    await Promise.resolve();

    graphql.emit({
      uiapi: {
        query: {
          Account: {
            edges: [
              {
                node: {
                  Id: "001000000000001",
                  Name: { value: "Acme", displayValue: null },
                  Industry: {
                    value: "Technology",
                    displayValue: "Technology"
                  },
                  AnnualRevenue: { value: 1000000, displayValue: "$1,000,000" }
                }
              }
            ]
          }
        }
      }
    });
    await Promise.resolve();

    expect(element.shadowRoot.querySelector("lightning-datatable")).toBeNull();
    expect(
      element.shadowRoot.querySelector(".account-card").textContent
    ).toContain("Acme");
  });
});
