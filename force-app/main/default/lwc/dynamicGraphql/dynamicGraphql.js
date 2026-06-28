import { gql } from "lightning/graphql";

const API_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
const FIELD_PATH_PATTERN =
  /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*){0,5}$/;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 200;

export function normalizeDynamicGraphqlConfiguration(input) {
  const configuration = parseConfiguration(input);
  const objectApiName =
    configuration.objectApiName || configuration.objectName || "Account";
  if (!API_NAME_PATTERN.test(objectApiName)) {
    throw new Error("Object API name is invalid.");
  }

  const fieldInput = configuration.fields || configuration.fieldApiNames;
  const fields = normalizeFields(fieldInput);
  const where = parseObjectValue(
    configuration.where ?? configuration.whereClause ?? {},
    "WHERE"
  );
  const orderBy = normalizeOrderBy(configuration.orderBy || {});

  return {
    ...configuration,
    objectApiName,
    fields,
    where,
    orderBy,
    recordLimit: normalizeLimit(
      configuration.recordLimit ?? configuration.limit
    )
  };
}

export function createDynamicGraphqlQuery(input) {
  const configuration = normalizeDynamicGraphqlConfiguration(input);
  const fieldConfigs = ensureRecordId(
    input?.fieldConfigs || configuration.fields
  );
  const fieldSelection = buildGraphqlFieldSelection(fieldConfigs);

  return gql`
    query DynamicReusableQuery(
      $first: Int!
      $where: ${configuration.objectApiName}_Filter
      $orderBy: ${configuration.objectApiName}_OrderBy
    ) {
      uiapi {
        query {
          ${configuration.objectApiName}(
            first: $first
            where: $where
            orderBy: $orderBy
          ) {
            edges {
              node {
                ${fieldSelection}
              }
            }
          }
        }
      }
    }
  `;
}

export function createDynamicGraphqlVariables(input) {
  const configuration = normalizeDynamicGraphqlConfiguration(input);
  const variables = {
    first: configuration.recordLimit,
    where: configuration.where
  };

  if (Object.keys(configuration.orderBy).length > 0) {
    variables.orderBy = configuration.orderBy;
  }
  return variables;
}

export function buildGraphqlFieldSelection(fieldConfigs) {
  const selectionTree = new Map();

  for (const field of normalizeFieldConfigs(fieldConfigs)) {
    let currentLevel = selectionTree;
    field.segments.forEach((segment, index) => {
      if (!currentLevel.has(segment)) {
        currentLevel.set(segment, { children: new Map(), field: undefined });
      }
      const node = currentLevel.get(segment);
      if (index === field.segments.length - 1) {
        node.field = field;
      } else {
        currentLevel = node.children;
      }
    });
  }

  return serializeSelectionTree(selectionTree);
}

export function extractDynamicGraphqlNodes(data, objectApiName) {
  return (data?.uiapi?.query?.[objectApiName]?.edges || []).map(
    ({ node }) => node
  );
}

export function flattenDynamicGraphqlRecords({
  data,
  objectApiName,
  fieldConfigs
}) {
  const normalizedFields = ensureRecordId(fieldConfigs);
  return extractDynamicGraphqlNodes(data, objectApiName).map((node) => {
    return normalizedFields.reduce((record, field) => {
      record[field.dataKey] = readGraphqlValue(
        readNestedValue(node, field.segments)
      );
      return record;
    }, {});
  });
}

function parseConfiguration(input) {
  if (typeof input !== "string") {
    return input && typeof input === "object" && !Array.isArray(input)
      ? input
      : {};
  }

  try {
    const parsed = JSON.parse(input);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Configuration must be a JSON object.");
    }
    return parsed;
  } catch (error) {
    throw new Error(`Configuration JSON is invalid: ${error.message}`);
  }
}

function normalizeFields(fieldInput) {
  let entries = fieldInput;
  if (typeof entries === "string") {
    const trimmed = entries.trim();
    if (trimmed.startsWith("[")) {
      try {
        entries = JSON.parse(trimmed);
      } catch (error) {
        throw new Error(`Fields JSON is invalid: ${error.message}`);
      }
    } else {
      entries = trimmed.split(",");
    }
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("At least one field is required.");
  }
  return normalizeFieldConfigs(entries);
}

function normalizeFieldConfigs(fieldConfigs) {
  return (fieldConfigs || []).map((entry, index) => {
    const field =
      typeof entry === "string"
        ? { apiName: entry.trim() }
        : { ...entry, apiName: String(entry?.apiName || "").trim() };
    if (!FIELD_PATH_PATTERN.test(field.apiName)) {
      throw new Error(`Invalid field API path: ${field.apiName || "(blank)"}.`);
    }

    const segments = field.segments || field.apiName.split(".");

    return {
      ...field,
      segments,
      dataKey:
        field.dataKey ||
        (field.apiName.includes(".")
          ? `relationshipField${index}`
          : field.apiName),
      dataType:
        field.dataType ||
        (segments[segments.length - 1] === "Id" ? "Id" : undefined)
    };
  });
}

function ensureRecordId(fieldConfigs) {
  const fields = normalizeFieldConfigs(fieldConfigs);
  if (!fields.some((field) => field.apiName === "Id")) {
    fields.unshift({
      apiName: "Id",
      label: "Record ID",
      type: "text",
      dataType: "Id",
      segments: ["Id"],
      dataKey: "Id"
    });
  }
  return fields;
}

function serializeSelectionTree(selectionTree) {
  return [...selectionTree.entries()]
    .map(([fieldName, node]) => {
      if (node.children.size > 0) {
        return `${fieldName} { ${serializeSelectionTree(node.children)} }`;
      }
      const scalarField =
        String(node.field?.dataType || "").toUpperCase() === "ID";
      return scalarField ? fieldName : `${fieldName} { value displayValue }`;
    })
    .join("\n");
}

function parseObjectValue(value, label) {
  if (typeof value !== "string") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${label} configuration must be a JSON object.`);
    }
    return value;
  }

  try {
    const parsed = JSON.parse(value || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${label} configuration must be a JSON object.`);
    }
    return parsed;
  } catch (error) {
    throw new Error(`${label} JSON is invalid: ${error.message}`);
  }
}

function normalizeOrderBy(orderBy) {
  if (typeof orderBy !== "string") {
    return orderBy && typeof orderBy === "object" && !Array.isArray(orderBy)
      ? orderBy
      : {};
  }

  const trimmed = orderBy.trim();
  if (!trimmed) {
    return {};
  }
  if (trimmed.startsWith("{")) {
    return parseObjectValue(trimmed, "orderBy");
  }

  const match = trimmed.match(/^([A-Za-z][A-Za-z0-9_]*)\s+(ASC|DESC)$/i);
  if (!match) {
    throw new Error('orderBy must use the format "CreatedDate DESC".');
  }
  return { [match[1]]: { order: match[2].toUpperCase() } };
}

function normalizeLimit(value) {
  const parsed = Number(value ?? DEFAULT_LIMIT);
  return Number.isInteger(parsed)
    ? Math.min(Math.max(parsed, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
}

function readNestedValue(node, segments) {
  return segments.reduce(
    (currentValue, segment) => currentValue?.[segment],
    node
  );
}

function readGraphqlValue(fieldValue) {
  if (fieldValue === null || fieldValue === undefined) {
    return "";
  }
  if (typeof fieldValue === "object") {
    return fieldValue.value ?? fieldValue.displayValue ?? "";
  }
  return fieldValue;
}
