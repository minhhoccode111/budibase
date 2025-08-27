import mammoth from "mammoth"
import { KoaFile } from "@budibase/types"

interface ExtractedField {
  name: string
  type: "text" | "number" | "date" | "email" | "image" | "table" | "select"
  placeholder?: string
  required?: boolean
  validation?: any
}

interface DocumentSection {
  name: string
  fields: ExtractedField[]
  repeatable?: boolean
  order: number
}

interface DocumentStructure {
  title: string
  sections: DocumentSection[]
  layout: "single-column" | "two-column" | "grid"
  metadata: {
    originalFileName: string
    fieldCount: number
    sectionCount: number
    createdAt: string
  }
}

export async function parseDocumentStructure(file: KoaFile): Promise<{
  fields: ExtractedField[]
  structure: DocumentStructure
  html: string
}> {
  // Convert DOCX to HTML
  const result = await mammoth.convertToHtml({ path: file.path })
  const html = result.value
  
  // Extract fields and structure
  const fields = extractFields(html)
  const sections = extractSections(html, fields)
  
  const structure: DocumentStructure = {
    title: extractDocumentTitle(html) || file.name.replace('.docx', ''),
    sections,
    layout: inferLayout(html),
    metadata: {
      originalFileName: file.name,
      fieldCount: fields.length,
      sectionCount: sections.length,
      createdAt: new Date().toISOString()
    }
  }

  return { fields, structure, html }
}

function extractFields(html: string): ExtractedField[] {
  const fields: ExtractedField[] = []
  
  // Extract {{field}} patterns
  const fieldRegex = /\{\{([^}]+)\}\}/g
  let match
  
  while ((match = fieldRegex.exec(html)) !== null) {
    const fieldName = match[1].trim()
    
    if (!fields.find(f => f.name === fieldName)) {
      fields.push({
        name: fieldName,
        type: inferFieldType(fieldName, html),
        placeholder: generatePlaceholder(fieldName),
        required: isFieldRequired(fieldName, html)
      })
    }
  }

  // Extract table structures
  const tableFields = extractTableFields(html)
  fields.push(...tableFields)

  return fields
}

function inferFieldType(fieldName: string, context: string): ExtractedField['type'] {
  const name = fieldName.toLowerCase()
  
  // Email detection
  if (name.includes('email') || name.includes('e-mail')) {
    return 'email'
  }
  
  // Date detection
  if (name.includes('date') || name.includes('time') || name.includes('birthday')) {
    return 'date'
  }
  
  // Number detection
  if (name.includes('age') || name.includes('number') || name.includes('amount') || 
      name.includes('price') || name.includes('quantity')) {
    return 'number'
  }
  
  // Image detection
  if (name.includes('image') || name.includes('photo') || name.includes('picture')) {
    return 'image'
  }
  
  // Select detection (if options are nearby)
  if (name.includes('select') || name.includes('choose') || name.includes('option')) {
    return 'select'
  }
  
  return 'text'
}

function generatePlaceholder(fieldName: string): string {
  const formatted = fieldName.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim()
  return `Enter ${formatted.toLowerCase()}`
}

function isFieldRequired(fieldName: string, context: string): boolean {
  const surroundingText = extractSurroundingText(fieldName, context)
  return /required|mandatory|\*/.test(surroundingText.toLowerCase())
}

function extractSurroundingText(fieldName: string, html: string): string {
  const fieldPattern = new RegExp(`(.{0,100})\\{\\{${fieldName}\\}\\}(.{0,100})`, 'i')
  const match = html.match(fieldPattern)
  return match ? match[1] + match[2] : ''
}

function extractTableFields(html: string): ExtractedField[] {
  const tableFields: ExtractedField[] = []
  const tableRegex = /<table[^>]*>(.*?)<\/table>/gs
  let tableMatch
  let tableIndex = 0
  
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableContent = tableMatch[1]
    const fieldRegex = /\{\{([^}]+)\}\}/g
    let fieldMatch
    
    const tableFieldNames: string[] = []
    while ((fieldMatch = fieldRegex.exec(tableContent)) !== null) {
      const fieldName = fieldMatch[1].trim()
      if (!tableFieldNames.includes(fieldName)) {
        tableFieldNames.push(fieldName)
      }
    }
    
    if (tableFieldNames.length > 0) {
      tableFields.push({
        name: `table_${tableIndex}`,
        type: 'table',
        placeholder: `Repeatable table with fields: ${tableFieldNames.join(', ')}`,
        required: false
      })
    }
    
    tableIndex++
  }
  
  return tableFields
}

function extractSections(html: string, fields: ExtractedField[]): DocumentSection[] {
  const sections: DocumentSection[] = []
  
  // Split by headings
  const headingRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi
  const parts = html.split(headingRegex)
  
  if (parts.length <= 1) {
    // No headings found, create single section
    return [{
      name: "Main Section",
      fields: fields,
      repeatable: false,
      order: 0
    }]
  }
  
  let currentSection: DocumentSection | null = null
  let sectionOrder = 0
  
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      // This is a heading
      if (currentSection) {
        sections.push(currentSection)
      }
      
      currentSection = {
        name: parts[i].replace(/<[^>]*>/g, '').trim(),
        fields: [],
        repeatable: false,
        order: sectionOrder++
      }
    } else if (currentSection && parts[i]) {
      // This is content after a heading
      const sectionFields = fields.filter(field => 
        parts[i].includes(`{{${field.name}}}`)
      )
      currentSection.fields = sectionFields
    }
  }
  
  if (currentSection) {
    sections.push(currentSection)
  }
  
  return sections
}

function extractDocumentTitle(html: string): string | null {
  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i)
  if (titleMatch) {
    return titleMatch[1].replace(/<[^>]*>/g, '').trim()
  }
  
  const firstHeading = html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i)
  if (firstHeading) {
    return firstHeading[1].replace(/<[^>]*>/g, '').trim()
  }
  
  return null
}

function inferLayout(html: string): DocumentStructure['layout'] {
  // Simple heuristic based on content structure
  const tableCount = (html.match(/<table/g) || []).length
  const columnCount = (html.match(/style="[^"]*column/g) || []).length
  
  if (tableCount > 2 || columnCount > 0) {
    return 'grid'
  }
  
  if (html.includes('float:') || html.includes('display: flex')) {
    return 'two-column'
  }
  
  return 'single-column'
}

export async function generateBudibaseTemplate(templateData: {
  fields: ExtractedField[]
  structure: DocumentStructure
  html: string
  fileName: string
}): Promise<any> {
  const { fields, structure, fileName } = templateData
  
  // Generate Budibase form components
  const components = fields.map(field => ({
    _id: generateComponentId(),
    _component: getBudibaseComponent(field.type),
    _instanceName: field.name,
    label: formatLabel(field.name),
    field: field.name,
    placeholder: field.placeholder,
    required: field.required,
    validation: field.validation,
    _styles: {
      normal: {},
      hover: {},
      active: {},
      selected: {}
    }
  }))
  
  // Create form structure
  const formTemplate = {
    name: structure.title,
    description: `Generated from ${fileName}`,
    components,
    structure: structure.sections,
    layout: structure.layout,
    metadata: structure.metadata
  }
  
  return formTemplate
}

function getBudibaseComponent(fieldType: ExtractedField['type']): string {
  const componentMap = {
    text: '@budibase/standard-components/stringfield',
    number: '@budibase/standard-components/numberfield', 
    email: '@budibase/standard-components/emailfield',
    date: '@budibase/standard-components/datepicker',
    image: '@budibase/standard-components/attachmentfield',
    select: '@budibase/standard-components/optionsfield',
    table: '@budibase/standard-components/repeater'
  }
  
  return componentMap[fieldType] || componentMap.text
}

function formatLabel(fieldName: string): string {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim()
}

function generateComponentId(): string {
  return Math.random().toString(36).substr(2, 9)
}