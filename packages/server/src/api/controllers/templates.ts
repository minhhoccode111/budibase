import nodeFetch from "node-fetch"
import { downloadTemplate as dlTemplate } from "../../utilities/fileSystem"
import env from "../../environment"
import { context, objectStore, tenancy } from "@budibase/backend-core"
import { v4 as uuid } from "uuid"
import {
  DownloadTemplateResponse,
  FetchGlobalTemplateResponse,
  UserCtx,
  TemplateMetadata,
  TemplateType,
} from "@budibase/types"
import { ObjectStoreBuckets } from "../../constants"

// development flag, can be used to test against templates exported locally
const DEFAULT_TEMPLATES_BUCKET =
  "prod-budi-templates.s3-eu-west-1.amazonaws.com"

export async function fetch(ctx: UserCtx<void, FetchGlobalTemplateResponse>) {
  let type = env.TEMPLATE_REPOSITORY
  let response,
    error = false
  let defaultTemplates: TemplateMetadata[] = []

  // Fetch default templates from S3
  try {
    response = await nodeFetch(
      `https://${DEFAULT_TEMPLATES_BUCKET}/manifest.json`
    )
    if (response.status !== 200) {
      error = true
    }
  } catch (err) {
    error = true
  }

  if (!error && response) {
    const json = await response.json()
    defaultTemplates = Object.values(json.templates[type]) as TemplateMetadata[]
  }

  // Fetch custom DOCX templates from global database
  let customTemplates: TemplateMetadata[] = []
  try {
    const db = tenancy.getGlobalDB()
    const result = await db.allDocs({
      startkey: "docx_template_",
      endkey: "docx_template_\ufff0",
      include_docs: true,
    })

    customTemplates = result.rows
      .map(row => row.doc)
      .filter(doc => doc && doc.templateType === "docx")
      .map(doc => ({
        key: doc.key,
        name: doc.name,
        description: doc.description,
        type: doc.type,
        category: doc.category,
        background: doc.background,
        icon: doc.icon,
        image: doc.image,
        url: doc.url,
        new: doc.new,
        // Include custom DOCX properties
        docxFile: doc.docxFile,
        fields: doc.fields,
        parseResults: doc.parseResults,
        createdAt: doc.createdAt,
        createdBy: doc.createdBy,
      })) as TemplateMetadata[]
  } catch (err) {
    console.error("Error fetching custom templates:", err)
  }

  // Combine default and custom templates
  ctx.body = [...defaultTemplates, ...customTemplates]
}

// can't currently test this, have to ignore from coverage
/* istanbul ignore next */
export async function downloadTemplate(
  ctx: UserCtx<void, DownloadTemplateResponse>
) {
  const { type, name } = ctx.params

  await dlTemplate(type, name)

  ctx.body = {
    message: `template ${type}:${name} downloaded successfully.`,
  }
}

export async function uploadDocxTemplate(ctx: UserCtx) {
  const file = ctx.request?.files?.file
  if (!file || Array.isArray(file)) {
    ctx.throw(400, "No file or multiple files provided")
  }

  if (!file.name?.toLowerCase().endsWith(".docx")) {
    ctx.throw(400, "Invalid file type - must be a DOCX file")
  }

  const { name, description, fields, parseResults } = ctx.request.body

  if (!name || !name.trim()) {
    ctx.throw(400, "Template name is required")
  }

  try {
    // Generate unique template key
    const templateId = uuid()
    const templateKey = `docx/${templateId}`

    // Upload DOCX file to object storage (use global templates bucket)
    const fileKey = `global/templates/${templateId}.docx`
    const uploadResponse = await objectStore.upload({
      bucket: ObjectStoreBuckets.GLOBAL,
      filename: fileKey,
      path: file.path,
      type:
        file.type ||
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })

    // Parse fields and parseResults from JSON strings
    let parsedFields = []
    let parsedResults = null

    try {
      parsedFields = fields ? JSON.parse(fields) : []
      parsedResults = parseResults ? JSON.parse(parseResults) : null
    } catch (error) {
      console.error("Error parsing template data:", error)
    }

    // Create template metadata
    const templateMetadata: TemplateMetadata = {
      key: templateKey,
      name: name.trim(),
      description: description?.trim() || `DOCX template: ${name}`,
      type: TemplateType.APP,
      category: "Custom",
      background: "#4285f4", // Default blue background
      icon: "FileText", // Default icon for DOCX templates
      image: "", // No preview image for now
      url: "", // Not used for custom templates
      new: true, // Mark as new template
      // Custom properties for DOCX templates
      docxFile: {
        key: uploadResponse.Key!,
        url: await objectStore.getGlobalFileUrl(
          "templates",
          `${templateId}.docx`
        ),
        originalName: file.name,
        size: file.size,
      },
      fields: parsedFields,
      parseResults: parsedResults,
      createdAt: new Date().toISOString(),
      createdBy: ctx.user?._id,
    }

    // Store template metadata in global database
    const db = tenancy.getGlobalDB()
    const templateDoc = {
      _id: `docx_template_${templateId}`,
      type: "template",
      templateType: "docx",
      ...templateMetadata,
    }

    const response = await db.put(templateDoc)

    ctx.body = {
      ...templateMetadata,
      _id: templateDoc._id,
      _rev: response.rev,
      message: "DOCX template uploaded successfully",
    }
  } catch (error) {
    console.error("Error uploading DOCX template:", error)
    ctx.throw(500, "Failed to upload DOCX template")
  }
}
