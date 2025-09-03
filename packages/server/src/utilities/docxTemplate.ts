import { context, tenancy } from "@budibase/backend-core"
import { FieldType, Table, Screen, Layout } from "@budibase/types"
import {
  generateTableID,
  generateScreenID,
  generateLayoutID,
  generateComponentID,
} from "../db/utils"
import { USERS_TABLE_SCHEMA } from "../constants"
import { BASE_LAYOUTS, EMPTY_LAYOUT } from "../constants/layouts"
import sdk from "../sdk"

interface DocxTemplateField {
  name: string
  type: string
  required: boolean
  path?: string
  isNested?: boolean
  isConditional?: boolean
  isLoop?: boolean
}

interface DocxTemplateData {
  name: string
  description: string
  fields: DocxTemplateField[]
  parseResults?: any
}

/**
 * Maps DOCX template field types to Budibase field types
 */
const DOCX_TO_BUDIBASE_TYPE_MAP: Record<string, FieldType> = {
  text: FieldType.STRING,
  email: FieldType.STRING,
  phone: FieldType.STRING,
  number: FieldType.NUMBER,
  date: FieldType.DATETIME,
  boolean: FieldType.BOOLEAN,
  url: FieldType.STRING,
}

/**
 * Creates a table schema from DOCX template fields
 */
function createTableFromDocxFields(
  fields: DocxTemplateField[],
  tableName: string
): Table {
  const tableId = generateTableID()
  const schema: any = {}

  // Add default _id field
  schema._id = {
    name: "_id",
    type: FieldType.STRING,
    autocolumn: true,
    constraints: {
      presence: false,
    },
  }

  // Convert DOCX fields to table schema (Phase 1 - primitive types only)
  fields.forEach(field => {
    // Skip complex fields for Phase 1
    if (field.isNested || field.isConditional || field.isLoop) {
      return
    }

    const fieldName = field.name
    const budibaseType =
      DOCX_TO_BUDIBASE_TYPE_MAP[field.type] || FieldType.STRING

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
    primaryDisplay:
      fields.find(
        f => f.type === "text" && !f.isNested && !f.isConditional && !f.isLoop
      )?.name || "_id",
  } as Table
}

/**
 * Creates a basic form screen for the DOCX template
 */
function createFormScreen(
  table: Table,
  templateName: string,
  workspaceAppId: string
): Omit<Screen, "_id" | "_rev"> {
  const formBlockId = generateComponentID()
  const containerComponentId = generateComponentID()

  // Create form block component with proper structure
  const formBlockComponent = {
    _id: formBlockId,
    _component: "@budibase/standard-components/formblock",
    _instanceName: `${templateName} Form`,
    _styles: {
      normal: {},
      hover: {},
      active: {},
      selected: {},
    },
    _children: [],
    dataSource: {
      label: table.name,
      tableId: table._id,
      type: "table",
    },
    actionType: "Create",
    title: `${templateName} Form`,
    buttonPosition: "bottom",
    size: "spectrum--medium",
    disabled: false,
    fields: [],
    buttons: [],
    notificationOverride: false,
    buttonsCollapsed: false,
    buttonsCollapsedText: "Show buttons",
  }

  // Create container component as the root screen component
  const containerComponent = {
    _id: containerComponentId,
    _component: "@budibase/standard-components/container",
    _instanceName: `${templateName} Screen`,
    _styles: {
      normal: {},
      hover: {},
      active: {},
      selected: {},
    },
    _children: [formBlockComponent],
    layout: "flex",
    direction: "column",
    hAlign: "stretch",
    vAlign: "top",
    size: "grow",
    gap: "M",
  }

  return {
    name: `${templateName} Form`,
    showNavigation: true,
    width: "Large",
    routing: {
      route: `/${templateName.toLowerCase().replace(/\s+/g, "-")}`,
      roleId: "BASIC",
      homeScreen: false,
    },
    props: containerComponent,
    workspaceAppId,
  }
}

/**
 * Creates a basic layout for the app
 */
function createBasicLayout(): Layout {
  const layoutId = generateLayoutID()

  // Use the first base layout (Navigation Layout) as the default
  const baseLayout = BASE_LAYOUTS[0]

  return {
    ...baseLayout,
    _id: layoutId,
    name: "Main Layout",
  } as Layout
}

/**
 * Fetches DOCX template data from the global database
 */
async function getDocxTemplateData(
  templateKey: string
): Promise<DocxTemplateData | null> {
  try {
    const db = tenancy.getGlobalDB()
    const templateId = templateKey.replace("docx/", "")
    const templateDoc = await db.get(`docx_template_${templateId}`)

    return {
      name: templateDoc.name,
      description: templateDoc.description,
      fields: templateDoc.fields || [],
      parseResults: templateDoc.parseResults,
    }
  } catch (error) {
    console.error("Error fetching DOCX template data:", error)
    return null
  }
}

/**
 * Creates an app from a DOCX template
 */
export async function createAppFromDocxTemplate(
  appId: string,
  db: any,
  templateKey: string
): Promise<void> {
  try {
    // Get template data
    const templateData = await getDocxTemplateData(templateKey)
    if (!templateData) {
      throw new Error(`DOCX template not found: ${templateKey}`)
    }

    // Filter fields for Phase 1 compatibility (primitive types only)
    const compatibleFields = templateData.fields.filter(
      field =>
        !field.isNested &&
        !field.isConditional &&
        !field.isLoop &&
        DOCX_TO_BUDIBASE_TYPE_MAP[field.type]
    )

    if (compatibleFields.length === 0) {
      console.warn(
        "No compatible fields found in DOCX template, creating basic app"
      )
      // Create the users table as fallback
      await db.put(USERS_TABLE_SCHEMA)
      return
    }

    // Create table from DOCX fields
    const table = createTableFromDocxFields(
      compatibleFields,
      `${templateData.name} Data`
    )
    await db.put(table)

    // Create basic layout
    const layout = createBasicLayout()
    await db.put(layout)

    // Create workspace app
    const workspaceApp = await sdk.workspaceApps.create({
      name: templateData.name,
      url: "/",
      navigation: {
        navigation: "Top",
        links: [],
      },
      disabled: false,
      isDefault: true,
    })

    // Create form screen using the workspace app ID
    const screenData = createFormScreen(
      table,
      templateData.name,
      workspaceApp._id!
    )
    const screen = await sdk.screens.create(screenData)

    // Create the users table (always needed)
    await db.put(USERS_TABLE_SCHEMA)

    console.log(
      `Successfully created app from DOCX template: ${templateData.name}`
    )
    console.log(`Created table with ${compatibleFields.length} fields`)
    console.log(`Created workspace app: ${workspaceApp._id}`)
    console.log(`Created screen: ${screen._id}`)
  } catch (error) {
    console.error("Error creating app from DOCX template:", error)
    // Fallback to basic app creation
    await db.put(USERS_TABLE_SCHEMA)
    throw error
  }
}

/**
 * Validates DOCX template fields for Phase 1 compatibility
 */
export function validateDocxFieldsForPhase1(fields: DocxTemplateField[]) {
  const compatibleFields = []
  const skippedFields = []
  const warnings = []

  fields.forEach(field => {
    if (field.isNested || field.isConditional || field.isLoop) {
      skippedFields.push(field)
      warnings.push(
        `Skipped complex field: ${field.name} (${field.isNested ? "nested" : field.isConditional ? "conditional" : "loop"})`
      )
    } else if (!DOCX_TO_BUDIBASE_TYPE_MAP[field.type]) {
      skippedFields.push(field)
      warnings.push(
        `Skipped unsupported field type: ${field.name} (${field.type})`
      )
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
