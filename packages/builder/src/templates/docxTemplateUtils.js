import { FieldType } from "@budibase/types"
import { Component } from "./Component"
import { generateTableID } from "../db/utils"

/**
 * Maps DOCX template field types to Budibase field types
 */
const DOCX_TO_BUDIBASE_TYPE_MAP = {
  text: FieldType.STRING,
  email: FieldType.STRING,
  phone: FieldType.STRING,
  number: FieldType.NUMBER,
  date: FieldType.DATETIME,
  boolean: FieldType.BOOLEAN,
  url: FieldType.STRING,
}

/**
 * Maps DOCX template field types to Budibase form component types
 */
const DOCX_TO_COMPONENT_MAP = {
  text: "stringfield",
  email: "stringfield",
  phone: "stringfield", 
  number: "numberfield",
  date: "datetimefield",
  boolean: "booleanfield",
  url: "stringfield",
}

/**
 * Creates a table schema from DOCX template fields
 * @param {Array} fields - Parsed fields from DOCX template
 * @param {string} tableName - Name for the table
 * @returns {Object} Table schema object
 */
export function createTableFromDocxFields(fields, tableName) {
  const tableId = generateTableID()
  const schema = {}

  // Add default _id field
  schema._id = {
    name: "_id",
    type: FieldType.STRING,
    autocolumn: true,
    constraints: {
      presence: false,
    },
  }

  // Convert DOCX fields to table schema
  fields.forEach(field => {
    // Skip complex fields for Phase 1 (nested, conditional, loop)
    if (field.isNested || field.isConditional || field.isLoop) {
      return
    }

    const fieldName = field.name
    const budibaseType = DOCX_TO_BUDIBASE_TYPE_MAP[field.type] || FieldType.STRING

    schema[fieldName] = {
      name: fieldName,
      type: budibaseType,
      constraints: {
        presence: field.required,
      },
    }

    // Add specific constraints based on field type
    if (field.type === "email") {
      schema[fieldName].constraints.email = true
    } else if (field.type === "url") {
      schema[fieldName].constraints.url = true
    } else if (field.type === "date") {
      schema[fieldName].dateOnly = true
    }
  })

  return {
    _id: tableId,
    name: tableName,
    type: "table",
    schema,
    primaryDisplay: fields.find(f => f.type === "text")?.name || "_id",
  }
}

/**
 * Creates form components from DOCX template fields
 * @param {Array} fields - Parsed fields from DOCX template
 * @param {string} tableId - ID of the associated table
 * @returns {Array} Array of form component definitions
 */
export function createFormComponentsFromDocxFields(fields, tableId) {
  const components = []

  fields.forEach(field => {
    // Skip complex fields for Phase 1
    if (field.isNested || field.isConditional || field.isLoop) {
      return
    }

    const componentType = DOCX_TO_COMPONENT_MAP[field.type] || "stringfield"
    const fullComponentType = `@budibase/standard-components/${componentType}`

    const component = new Component(fullComponentType)
      .instanceName(field.name)
      .customProps({
        field: field.name,
        label: field.name,
        placeholder: `Enter ${field.name}`,
        disabled: false,
        readonly: false,
      })

    // Add type-specific properties
    if (field.type === "email") {
      component.customProps({
        placeholder: "Enter email address",
      })
    } else if (field.type === "phone") {
      component.customProps({
        placeholder: "Enter phone number",
      })
    } else if (field.type === "url") {
      component.customProps({
        placeholder: "Enter URL",
      })
    } else if (field.type === "boolean") {
      component.customProps({
        text: field.name,
        label: "",
      })
    } else if (field.type === "date") {
      component.customProps({
        enableTime: false,
        timeOnly: false,
        ignoreTimezones: false,
      })
    }

    components.push(component)
  })

  return components
}

/**
 * Creates a complete form screen from DOCX template
 * @param {Object} templateData - Template data including fields and metadata
 * @param {string} workspaceAppId - Workspace app ID
 * @returns {Object} Screen definition with form components
 */
export function createScreenFromDocxTemplate(templateData, workspaceAppId) {
  const { fields, name } = templateData
  
  // Create table for the form data
  const table = createTableFromDocxFields(fields, `${name} Data`)
  
  // Create form components
  const formComponents = createFormComponentsFromDocxFields(fields, table._id)
  
  // Create form container
  const formId = `form_${table._id}`
  const formBlock = new Component("@budibase/standard-components/formblock", formId)
    .customProps({
      dataSource: {
        label: table.name,
        tableId: table._id,
        type: "table",
      },
      actionType: "Create",
      title: `${name} Form`,
      buttonPosition: "bottom",
    })
    .instanceName(`${name} - Form block`)

  // Add form components to the form block
  formComponents.forEach(component => {
    formBlock.addChild(component.json())
  })

  return {
    table,
    screen: {
      _id: `screen_${table._id}`,
      routing: {
        route: `/${name.toLowerCase().replace(/\s+/g, "-")}`,
        roleId: "BASIC",
      },
      props: {
        _id: `screen_${table._id}`,
        _component: "@budibase/standard-components/screenslotwrapper",
        _instanceName: `${name} Screen`,
        _children: [formBlock.json()],
      },
    },
  }
}

/**
 * Validates DOCX template fields for Phase 1 compatibility
 * @param {Array} fields - Parsed fields from DOCX template
 * @returns {Object} Validation result with compatible fields and warnings
 */
export function validateDocxFieldsForPhase1(fields) {
  const compatibleFields = []
  const skippedFields = []
  const warnings = []

  fields.forEach(field => {
    if (field.isNested || field.isConditional || field.isLoop) {
      skippedFields.push(field)
      warnings.push(`Skipped complex field: ${field.name} (${field.isNested ? 'nested' : field.isConditional ? 'conditional' : 'loop'})`)
    } else if (!DOCX_TO_BUDIBASE_TYPE_MAP[field.type]) {
      skippedFields.push(field)
      warnings.push(`Skipped unsupported field type: ${field.name} (${field.type})`)
    } else {
      compatibleFields.push(field)
    }
  })

  return {
    compatibleFields,
    skippedFields,
    warnings,
    hasCompatibleFields: compatibleFields.length > 0,
  }
}
