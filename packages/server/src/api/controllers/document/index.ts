import { Ctx } from "@budibase/types"
import { parseDocumentStructure, generateBudibaseTemplate } from "../../../utilities/documentProcessor"

export async function parseDocument(ctx: Ctx) {
  const file = ctx.request.files?.file
  
  if (!file || Array.isArray(file)) {
    ctx.throw(400, "Single .docx file required")
  }
  
  if (!file.name?.toLowerCase().endsWith('.docx')) {
    ctx.throw(400, "File must be a .docx document")
  }
  
  try {
    const result = await parseDocumentStructure(file)
    ctx.body = result
  } catch (error) {
    ctx.throw(500, `Document parsing failed: ${error.message}`)
  }
}

export async function generateTemplate(ctx: Ctx) {
  const templateData = ctx.request.body
  
  if (!templateData.fields || !templateData.structure) {
    ctx.throw(400, "Template data missing required fields")
  }
  
  try {
    const template = await generateBudibaseTemplate(templateData)
    ctx.body = { template }
  } catch (error) {
    ctx.throw(500, `Template generation failed: ${error.message}`)
  }
}