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

  let file: File | null = null
  let templateName = ""
  let templateDescription = ""
  let uploading = false
  let parsedFields: any[] = []
  let showPreview = false

  $: canSubmit = file && templateName.trim() && !uploading

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

    try {
      // TODO: Implement DOCX parsing
      // For now, simulate parsing with mock data
      parsedFields = [
        { name: "customerName", type: "text", required: true },
        { name: "email", type: "email", required: true },
        { name: "phone", type: "text", required: false },
        { name: "date", type: "date", required: true },
      ]
      showPreview = true
    } catch (error) {
      notifications.error("Failed to parse DOCX file")
      console.error("DOCX parsing error:", error)
    }
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

      // TODO: Create API endpoint for DOCX template upload
      // const response = await API.uploadDocxTemplate(formData)

      // For now, simulate successful upload
      await new Promise(resolve => setTimeout(resolve, 2000))

      notifications.success("Template uploaded successfully")

      // Reset form
      file = null
      templateName = ""
      templateDescription = ""
      parsedFields = []
      showPreview = false
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
      Upload a DOCX file with field placeholders like {"{{field}}"} to create a form
      template. Supported formats: *.docx
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

    {#if file}
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

      {#if showPreview && parsedFields.length > 0}
        <div class="preview-section">
          <Body size="M" weight="600">Detected Fields:</Body>
          <div class="fields-preview">
            {#each parsedFields as field}
              <div class="field-item">
                <span class="field-name">{field.name}</span>
                <span class="field-type">{field.type}</span>
                {#if field.required}
                  <span class="field-required">Required</span>
                {/if}
              </div>
            {/each}
          </div>
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

  .fields-preview {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    margin-top: var(--spacing-s);
  }

  .field-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-s);
    padding: var(--spacing-xs);
    background: var(--background);
    border-radius: var(--border-radius-s);
    border: 1px solid var(--border-light);
  }

  .field-name {
    font-weight: 600;
    color: var(--text);
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

  .uploading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-s);
    padding: var(--spacing-l);
  }
</style>
