<script lang="ts">
  import { 
    ModalContent, 
    Layout, 
    Button, 
    Icon, 
    Body, 
    Heading,
    ProgressBar,
    notifications,
    Dropzone
  } from "@budibase/bbui"
  import { createEventDispatcher } from "svelte"
  import { API } from "@/api"

  const dispatch = createEventDispatcher()

  let uploadedFile = null
  let isProcessing = false
  let processingStep = ""
  let extractedFields = []
  let documentStructure = null
  let previewHtml = ""

  const steps = [
    "Uploading document...",
    "Parsing document structure...", 
    "Extracting form fields...",
    "Generating template components...",
    "Creating Budibase template..."
  ]

  const processDocumentFile = async (fileList) => {
    if (!fileList?.length) return []
    
    const file = fileList[0]
    if (!file.name.toLowerCase().endsWith('.docx')) {
      notifications.error("Please upload a .docx file")
      return []
    }
    
    return [{
      name: file.name,
      type: file.type,
      file: file
    }]
  }

  const handleFileUpload = async (event) => {
    const files = event.detail
    if (files?.length) {
      uploadedFile = files[0]
      await processDocument()
    }
  }

  const processDocument = async () => {
    if (!uploadedFile) return

    isProcessing = true
    
    try {
      const formData = new FormData()
      formData.append('file', uploadedFile.file)

      // Step 1: Upload and parse
      processingStep = steps[0]
      await new Promise(resolve => setTimeout(resolve, 500))

      processingStep = steps[1]
      const parseResponse = await API.parseDocumentStructure(formData)
      
      // Step 2: Extract fields
      processingStep = steps[2]
      await new Promise(resolve => setTimeout(resolve, 500))
      
      extractedFields = parseResponse.fields
      documentStructure = parseResponse.structure
      previewHtml = parseResponse.html

      // Step 3: Generate components
      processingStep = steps[3]
      await new Promise(resolve => setTimeout(resolve, 500))

      // Step 4: Create template
      processingStep = steps[4]
      const templateResponse = await API.generateBudibaseTemplate({
        fields: extractedFields,
        structure: documentStructure,
        html: previewHtml,
        fileName: uploadedFile.name
      })

      notifications.success("Document template created successfully!")
      dispatch("template-created", templateResponse)

    } catch (error) {
      notifications.error(`Failed to process document: ${error.message}`)
    } finally {
      isProcessing = false
      processingStep = ""
    }
  }

  const handleCancel = () => {
    dispatch("cancel")
  }
</script>

<ModalContent
  title="Create Template from Document"
  size="L"
  showCancelButton={true}
  showConfirmButton={false}
  cancelText="Cancel"
  onCancel={handleCancel}
>
  <Layout noPadding gap="L">
    {#if !uploadedFile && !isProcessing}
      <!-- Upload Interface -->
      <div class="upload-section">
        <Heading size="S">Upload Word Document</Heading>
        <Body size="S">
          Upload a .docx file to automatically generate a Budibase template. 
          Use placeholders like {{field_name}} in your document for form fields.
        </Body>
        
        <Dropzone
          gallery={false}
          label="Drop your .docx file here or click to browse"
          value={uploadedFile ? [uploadedFile] : []}
          on:change={handleFileUpload}
          processFiles={processDocumentFile}
          extensions=".docx"
          maximum={1}
          fileTags={["Microsoft Word", ".docx"]}
        />

        <div class="features-info">
          <Heading size="XS">What we'll extract:</Heading>
          <div class="feature-list">
            <div class="feature-item">
              <Icon name="edit" />
              <span>Text fields from {{placeholders}}</span>
            </div>
            <div class="feature-item">
              <Icon name="table" />
              <span>Tables as repeatable sections</span>
            </div>
            <div class="feature-item">
              <Icon name="image" />
              <span>Image placeholders</span>
            </div>
            <div class="feature-item">
              <Icon name="layout" />
              <span>Document structure & sections</span>
            </div>
          </div>
        </div>
      </div>

    {:else if isProcessing}
      <!-- Processing Interface -->
      <div class="processing-section">
        <Heading size="S">Processing Document</Heading>
        <Body size="S">{processingStep}</Body>
        
        <ProgressBar 
          value={steps.indexOf(processingStep) + 1} 
          max={steps.length}
        />

        <div class="processing-steps">
          {#each steps as step, index}
            <div 
              class="step" 
              class:completed={steps.indexOf(processingStep) > index}
              class:active={steps.indexOf(processingStep) === index}
            >
              <div class="step-indicator">
                {#if steps.indexOf(processingStep) > index}
                  <Icon name="checkmark" />
                {:else if steps.indexOf(processingStep) === index}
                  <div class="spinner"></div>
                {:else}
                  {index + 1}
                {/if}
              </div>
              <span>{step}</span>
            </div>
          {/each}
        </div>
      </div>

    {:else if extractedFields.length > 0}
      <!-- Preview Interface -->
      <div class="preview-section">
        <Heading size="S">Template Preview</Heading>
        <Body size="S">
          Found {extractedFields.length} fields in your document. 
          Click "Create Template" to generate your Budibase form.
        </Body>

        <div class="preview-content">
          <div class="fields-preview">
            <Heading size="XS">Extracted Fields:</Heading>
            {#each extractedFields as field}
              <div class="field-item">
                <Icon name={field.type === 'text' ? 'edit' : field.type === 'image' ? 'image' : 'table'} />
                <span class="field-name">{field.name}</span>
                <span class="field-type">{field.type}</span>
              </div>
            {/each}
          </div>

          {#if previewHtml}
            <div class="document-preview">
              <Heading size="XS">Document Preview:</Heading>
              <div class="html-preview">
                {@html previewHtml}
              </div>
            </div>
          {/if}
        </div>

        <Button cta on:click={() => dispatch("create-template", { fields: extractedFields, structure: documentStructure })}>
          Create Budibase Template
        </Button>
      </div>
    {/if}
  </Layout>
</ModalContent>

<style>
  .upload-section {
    text-align: center;
    padding: var(--spacing-xl);
  }

  .features-info {
    margin-top: var(--spacing-xl);
    text-align: left;
  }

  .feature-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-m);
    margin-top: var(--spacing-m);
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-s);
  }

  .processing-section {
    padding: var(--spacing-xl);
    text-align: center;
  }

  .processing-steps {
    margin-top: var(--spacing-xl);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-m);
    text-align: left;
  }

  .step {
    display: flex;
    align-items: center;
    gap: var(--spacing-m);
    opacity: 0.5;
  }

  .step.active {
    opacity: 1;
    font-weight: 600;
  }

  .step.completed {
    opacity: 0.8;
    color: var(--green);
  }

  .step-indicator {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--grey-4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
  }

  .step.active .step-indicator {
    background: var(--blue);
    color: white;
  }

  .step.completed .step-indicator {
    background: var(--green);
    color: white;
  }

  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid transparent;
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .preview-section {
    padding: var(--spacing-l);
  }

  .preview-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-xl);
    margin: var(--spacing-xl) 0;
  }

  .fields-preview {
    border: 1px solid var(--grey-4);
    border-radius: 4px;
    padding: var(--spacing-m);
  }

  .field-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-s);
    padding: var(--spacing-s) 0;
    border-bottom: 1px solid var(--grey-5);
  }

  .field-item:last-child {
    border-bottom: none;
  }

  .field-name {
    font-weight: 600;
    flex: 1;
  }

  .field-type {
    font-size: 12px;
    color: var(--grey-6);
    background: var(--grey-2);
    padding: 2px 8px;
    border-radius: 12px;
  }

  .document-preview {
    border: 1px solid var(--grey-4);
    border-radius: 4px;
    padding: var(--spacing-m);
  }

  .html-preview {
    max-height: 300px;
    overflow-y: auto;
    background: white;
    padding: var(--spacing-m);
    border-radius: 4px;
    font-size: 14px;
  }
</style>