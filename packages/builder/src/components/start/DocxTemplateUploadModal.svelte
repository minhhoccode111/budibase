<script lang="ts">
  import {
    ModalContent,
    Layout,
    Body,
    Dropzone,
    Input,
    notifications,
    ProgressCircle,
  } from "@budibase/bbui"
  import * as mammoth from "mammoth"
  import { API } from "@/api"
  import { createEventDispatcher } from "svelte"

  const dispatch = createEventDispatcher()

  interface TemplateField {
    name: string
    type: string
    required: boolean
    path?: string
    isNested?: boolean
    isConditional?: boolean
    isLoop?: boolean
    condition?: string
    loopVariable?: string
    description?: string
  }

  interface ParsedTemplate {
    fields: TemplateField[]
    conditionals: string[]
    loops: string[]
    nestedObjects: string[]
    totalPlaceholders: number
  }

  let file: File | null = null
  let templateName = ""
  let templateDescription = ""
  let uploading = false
  let parsedFields: TemplateField[] = []
  let showPreview = false
  let parsing = false
  let parseResults: ParsedTemplate | null = null

  $: canSubmit = file && templateName.trim() && !uploading && !parsing

  const handleFileChange = (e: CustomEvent) => {
    const files = e.detail
    if (files && files.length > 0) {
      const selectedFile = files[0]

      // Additional validation for DOCX files
      if (!validateDocxFile(selectedFile)) {
        return
      }

      file = selectedFile
      // Auto-generate template name from filename
      if (!templateName) {
        templateName = selectedFile.name.replace(/\.[^/.]+$/, "")
      }
      // Parse the DOCX file to extract fields
      parseDocxFile()
    } else {
      file = null
      parsedFields = []
      showPreview = false
    }
  }

  const validateDocxFile = (selectedFile: File): boolean => {
    // Check file extension
    const fileName = selectedFile.name.toLowerCase()
    if (!fileName.endsWith(".docx")) {
      notifications.error(
        "Please select a valid DOCX file. Only Microsoft Word documents (.docx) are supported."
      )
      return false
    }

    // Check MIME type for additional validation
    const validMimeTypes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream", // Some browsers may report this for .docx files
    ]

    if (
      !validMimeTypes.includes(selectedFile.type) &&
      selectedFile.type !== ""
    ) {
      notifications.error(
        "Invalid file type. Please select a Microsoft Word document (.docx)."
      )
      return false
    }

    // Check file size (additional check beyond Dropzone's built-in validation)
    const maxSize = 10 * 1000000 // 10MB in bytes
    if (selectedFile.size > maxSize) {
      notifications.error(
        "File size too large. Please select a file smaller than 10MB."
      )
      return false
    }

    return true
  }

  const parseDocxFile = async () => {
    if (!file) return

    parsing = true
    try {
      // Extract text content from DOCX file using mammoth
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.extractRawText({ arrayBuffer })
      const documentText = result.value

      // Parse the document text for Documentero template syntax
      parseResults = parseDocumenteroTemplate(documentText)
      parsedFields = parseResults.fields
      showPreview = true

      notifications.success(
        `Successfully parsed template! Found ${parseResults.totalPlaceholders} placeholders across ${parsedFields.length} unique fields.`
      )
    } catch (error) {
      notifications.error("Failed to parse DOCX file")
      console.error("DOCX parsing error:", error)
      parsedFields = []
      showPreview = false
      parseResults = null
    } finally {
      parsing = false
    }
  }

  const parseDocumenteroTemplate = (text: string): ParsedTemplate => {
    const fields: TemplateField[] = []
    const conditionals: string[] = []
    const loops: string[] = []
    const nestedObjects: string[] = []
    const fieldMap = new Map<string, TemplateField>()

    // Regular expressions for different Documentero template patterns
    const patterns = {
      // Simple field placeholders: {{field_name}}
      simpleField: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g,

      // Nested object fields: {{object.property}} or {{object.nested.property}}
      nestedField:
        /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+)\s*\}\}/g,

      // Conditional blocks: {{#if condition}}...{{/if}}
      conditional: /\{\{\s*#if\s+([^}]+)\s*\}\}([\s\S]*?)\{\{\s*\/if\s*\}\}/g,

      // Loop blocks: {{#each items}}...{{/each}}
      loop: /\{\{\s*#each\s+([^}]+)\s*\}\}([\s\S]*?)\{\{\s*\/each\s*\}\}/g,

      // Helper functions: {{formatDate date "YYYY-MM-DD"}}
      helper: /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s+([^}]+)\s*\}\}/g,

      // Unless blocks: {{#unless condition}}...{{/unless}}
      unless:
        /\{\{\s*#unless\s+([^}]+)\s*\}\}([\s\S]*?)\{\{\s*\/unless\s*\}\}/g,

      // With blocks: {{#with object}}...{{/with}}
      with: /\{\{\s*#with\s+([^}]+)\s*\}\}([\s\S]*?)\{\{\s*\/with\s*\}\}/g,
    }

    let totalPlaceholders = 0

    // Parse simple fields
    let match
    while ((match = patterns.simpleField.exec(text)) !== null) {
      const fieldName = match[1]
      totalPlaceholders++

      if (!fieldMap.has(fieldName)) {
        const field: TemplateField = {
          name: fieldName,
          type: inferFieldType(fieldName),
          required: true, // Default to required, can be adjusted based on context
          isNested: false,
          isConditional: false,
          isLoop: false,
        }
        fieldMap.set(fieldName, field)
      }
    }

    // Reset regex lastIndex
    patterns.simpleField.lastIndex = 0

    // Parse nested fields
    while ((match = patterns.nestedField.exec(text)) !== null) {
      const fullPath = match[1]
      const pathParts = fullPath.split(".")
      const fieldName = pathParts[pathParts.length - 1]
      const objectPath = pathParts.slice(0, -1).join(".")
      totalPlaceholders++

      if (!fieldMap.has(fullPath)) {
        const field: TemplateField = {
          name: fieldName,
          type: inferFieldType(fieldName),
          required: true,
          path: fullPath,
          isNested: true,
          isConditional: false,
          isLoop: false,
          description: `Nested field from ${objectPath}`,
        }
        fieldMap.set(fullPath, field)

        if (!nestedObjects.includes(objectPath)) {
          nestedObjects.push(objectPath)
        }
      }
    }
    patterns.nestedField.lastIndex = 0

    // Parse conditional blocks
    while ((match = patterns.conditional.exec(text)) !== null) {
      const condition = match[1].trim()
      const content = match[2]
      totalPlaceholders++
      conditionals.push(condition)

      // Parse fields within conditional blocks
      const conditionalFields = parseDocumenteroTemplate(content)
      conditionalFields.fields.forEach(field => {
        const conditionalField = {
          ...field,
          isConditional: true,
          condition: condition,
          required: false, // Fields in conditionals are typically optional
        }
        const key = field.path || field.name
        if (!fieldMap.has(key)) {
          fieldMap.set(key, conditionalField)
        }
      })
    }
    patterns.conditional.lastIndex = 0

    // Parse loop blocks
    while ((match = patterns.loop.exec(text)) !== null) {
      const loopVariable = match[1].trim()
      const content = match[2]
      totalPlaceholders++
      loops.push(loopVariable)

      // Parse fields within loop blocks
      const loopFields = parseDocumenteroTemplate(content)
      loopFields.fields.forEach(field => {
        const loopField = {
          ...field,
          isLoop: true,
          loopVariable: loopVariable,
          required: false, // Fields in loops are typically optional
        }
        const key = field.path || field.name
        if (!fieldMap.has(key)) {
          fieldMap.set(key, loopField)
        }
      })
    }
    patterns.loop.lastIndex = 0

    // Parse unless blocks (similar to conditionals but inverted logic)
    while ((match = patterns.unless.exec(text)) !== null) {
      const condition = match[1].trim()
      const content = match[2]
      totalPlaceholders++
      conditionals.push(`NOT ${condition}`)

      const unlessFields = parseDocumenteroTemplate(content)
      unlessFields.fields.forEach(field => {
        const conditionalField = {
          ...field,
          isConditional: true,
          condition: `NOT ${condition}`,
          required: false,
        }
        const key = field.path || field.name
        if (!fieldMap.has(key)) {
          fieldMap.set(key, conditionalField)
        }
      })
    }
    patterns.unless.lastIndex = 0

    // Parse with blocks
    while ((match = patterns.with.exec(text)) !== null) {
      const contextObject = match[1].trim()
      const content = match[2]
      totalPlaceholders++

      if (!nestedObjects.includes(contextObject)) {
        nestedObjects.push(contextObject)
      }

      const withFields = parseDocumenteroTemplate(content)
      withFields.fields.forEach(field => {
        const contextualField = {
          ...field,
          path: field.path
            ? `${contextObject}.${field.path}`
            : `${contextObject}.${field.name}`,
          isNested: true,
          description: `Field within ${contextObject} context`,
        }
        const key = contextualField.path
        if (!fieldMap.has(key)) {
          fieldMap.set(key, contextualField)
        }
      })
    }
    patterns.with.lastIndex = 0

    // Convert map to array
    const allFields = Array.from(fieldMap.values())

    return {
      fields: allFields,
      conditionals,
      loops,
      nestedObjects,
      totalPlaceholders,
    }
  }

  const inferFieldType = (fieldName: string): string => {
    const name = fieldName.toLowerCase()

    // Email detection
    if (name.includes("email") || name.includes("mail")) {
      return "email"
    }

    // Phone detection
    if (
      name.includes("phone") ||
      name.includes("tel") ||
      name.includes("mobile")
    ) {
      return "phone"
    }

    // Date detection
    if (
      name.includes("date") ||
      name.includes("time") ||
      name.includes("created") ||
      name.includes("updated") ||
      name.includes("birth") ||
      name.includes("due")
    ) {
      return "date"
    }

    // Number detection
    if (
      name.includes("amount") ||
      name.includes("price") ||
      name.includes("cost") ||
      name.includes("total") ||
      name.includes("count") ||
      name.includes("quantity") ||
      name.includes("age") ||
      name.includes("number") ||
      name.includes("id")
    ) {
      return "number"
    }

    // Boolean detection
    if (
      name.includes("is") ||
      name.includes("has") ||
      name.includes("active") ||
      name.includes("enabled") ||
      name.includes("visible") ||
      name.includes("required")
    ) {
      return "boolean"
    }

    // URL detection
    if (
      name.includes("url") ||
      name.includes("link") ||
      name.includes("website")
    ) {
      return "url"
    }

    // Default to text
    return "text"
  }

  const uploadTemplate = async () => {
    if (!file || !templateName.trim()) return

    uploading = true
    try {
      // Create FormData for file upload
      const formData = new FormData()
      formData.append("file", file)
      formData.append("name", templateName)
      formData.append("description", templateDescription)
      formData.append("fields", JSON.stringify(parsedFields))

      // Include parsing results for backend processing
      if (parseResults) {
        formData.append("parseResults", JSON.stringify(parseResults))
      }

      // Upload template using API
      const response = await API.uploadDocxTemplate(formData)

      notifications.success(
        "Template uploaded successfully! It will appear in the template selection."
      )

      // Reset form
      file = null
      templateName = ""
      templateDescription = ""
      parsedFields = []
      showPreview = false
      parseResults = null

      // Dispatch event to parent to refresh templates
      dispatch("template-uploaded", response)
    } catch (error) {
      notifications.error("Failed to upload template")
      console.error("Upload error:", error)
    } finally {
      uploading = false
    }
  }

  const handleFileTooLarge = () => {
    notifications.error("File size too large. Please select a smaller file.")
  }
</script>

<ModalContent
  title="Upload DOCX Template"
  confirmText="Upload Template"
  onConfirm={uploadTemplate}
  disabled={!canSubmit}
  size="L"
>
  <Layout noPadding gap="M">
    <Body size="S">
      Upload a DOCX file with Documentero template syntax like {"{{field}}"}, {"{{#if condition}}...{{/if}}"},
      and {"{{#each items}}...{{/each}}"} to create a form template. Supported formats:
      *.docx
    </Body>

    <Dropzone
      label="DOCX Template File"
      value={file ? [file] : []}
      on:change={handleFileChange}
      {handleFileTooLarge}
      gallery={false}
      maximum={1}
      fileSizeLimit={10000000}
      {...{ extensions: ".docx" }}
    />

    {#if parsing}
      <div class="parsing">
        <ProgressCircle />
        <Body size="S">Parsing DOCX template...</Body>
      </div>
    {/if}

    {#if file && !parsing}
      <Input
        label="Template Name"
        bind:value={templateName}
        placeholder="Enter template name"
        disabled={uploading}
      />

      <Input
        label="Description (Optional)"
        bind:value={templateDescription}
        placeholder="Describe what this template is for"
        disabled={uploading}
      />

      {#if showPreview && parseResults}
        <div class="preview-section">
          <Body size="M" weight="600">
            Template Analysis: {parseResults.totalPlaceholders} placeholders found
          </Body>

          {#if parseResults.fields.length > 0}
            <div class="analysis-section">
              <Body size="S" weight="600"
                >Fields ({parseResults.fields.length}):</Body
              >
              <div class="fields-preview">
                {#each parseResults.fields as field}
                  <div class="field-item">
                    <div class="field-main">
                      <span class="field-name">
                        {field.path || field.name}
                      </span>
                      <span class="field-type">{field.type}</span>
                      {#if field.required}
                        <span class="field-required">Required</span>
                      {:else}
                        <span class="field-optional">Optional</span>
                      {/if}
                    </div>
                    {#if field.isNested}
                      <span class="field-badge nested">Nested</span>
                    {/if}
                    {#if field.isConditional}
                      <span class="field-badge conditional">Conditional</span>
                    {/if}
                    {#if field.isLoop}
                      <span class="field-badge loop">Loop</span>
                    {/if}
                    {#if field.description}
                      <div class="field-description">{field.description}</div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if parseResults.conditionals.length > 0}
            <div class="analysis-section">
              <Body size="S" weight="600"
                >Conditionals ({parseResults.conditionals.length}):</Body
              >
              <div class="tags-list">
                {#each parseResults.conditionals as condition}
                  <span class="tag conditional">{condition}</span>
                {/each}
              </div>
            </div>
          {/if}

          {#if parseResults.loops.length > 0}
            <div class="analysis-section">
              <Body size="S" weight="600"
                >Loops ({parseResults.loops.length}):</Body
              >
              <div class="tags-list">
                {#each parseResults.loops as loop}
                  <span class="tag loop">{loop}</span>
                {/each}
              </div>
            </div>
          {/if}

          {#if parseResults.nestedObjects.length > 0}
            <div class="analysis-section">
              <Body size="S" weight="600"
                >Nested Objects ({parseResults.nestedObjects.length}):</Body
              >
              <div class="tags-list">
                {#each parseResults.nestedObjects as obj}
                  <span class="tag nested">{obj}</span>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      {#if uploading}
        <div class="uploading">
          <ProgressCircle />
          <Body size="S">Uploading template...</Body>
        </div>
      {/if}
    {/if}
  </Layout>
</ModalContent>

<style>
  .preview-section {
    padding: var(--spacing-m);
    background: var(--background-alt);
    border-radius: var(--border-radius-s);
    border: 1px solid var(--border-light);
  }

  .analysis-section {
    margin-top: var(--spacing-m);
  }

  .fields-preview {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    margin-top: var(--spacing-s);
  }

  .field-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding: var(--spacing-s);
    background: var(--background);
    border-radius: var(--border-radius-s);
    border: 1px solid var(--border-light);
  }

  .field-main {
    display: flex;
    align-items: center;
    gap: var(--spacing-s);
    flex-wrap: wrap;
  }

  .field-name {
    font-weight: 600;
    color: var(--text);
    font-family: var(--font-mono);
  }

  .field-type {
    padding: 2px 6px;
    background: var(--blue-light);
    color: var(--blue);
    border-radius: var(--border-radius-s);
    font-size: 12px;
    text-transform: uppercase;
  }

  .field-required {
    padding: 2px 6px;
    background: var(--red-light);
    color: var(--red);
    border-radius: var(--border-radius-s);
    font-size: 12px;
  }

  .field-optional {
    padding: 2px 6px;
    background: var(--grey-light);
    color: var(--grey);
    border-radius: var(--border-radius-s);
    font-size: 12px;
  }

  .field-badge {
    padding: 2px 6px;
    border-radius: var(--border-radius-s);
    font-size: 11px;
    font-weight: 500;
  }

  .field-badge.nested {
    background: var(--purple-light);
    color: var(--purple);
  }

  .field-badge.conditional {
    background: var(--orange-light);
    color: var(--orange);
  }

  .field-badge.loop {
    background: var(--green-light);
    color: var(--green);
  }

  .field-description {
    font-size: 12px;
    color: var(--text-light);
    font-style: italic;
  }

  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    margin-top: var(--spacing-s);
  }

  .tag {
    padding: 4px 8px;
    border-radius: var(--border-radius-s);
    font-size: 12px;
    font-weight: 500;
    font-family: var(--font-mono);
  }

  .tag.conditional {
    background: var(--orange-light);
    color: var(--orange);
  }

  .tag.loop {
    background: var(--green-light);
    color: var(--green);
  }

  .tag.nested {
    background: var(--purple-light);
    color: var(--purple);
  }

  .parsing,
  .uploading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-s);
    padding: var(--spacing-l);
  }
</style>
