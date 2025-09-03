<script lang="ts">
  import { ModalContent, Layout, Button, Icon, Modal } from "@budibase/bbui"
  import TemplateCard from "@/components/common/TemplateCard.svelte"
  import DocxTemplateUploadModal from "./DocxTemplateUploadModal.svelte"
  import { templates } from "@/stores/portal"
  import type { TemplateMetadata } from "@budibase/types"

  // Create a document-like fallback pattern using SVG data URL for DOCX templates
  const createDocxFallbackImage = () => {
    const svg = `
      <svg width="200" height="140" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="lines" patternUnits="userSpaceOnUse" width="200" height="20">
            <rect width="200" height="20" fill="#f8f9fa"/>
            <rect x="20" y="16" width="160" height="2" fill="#e9ecef"/>
          </pattern>
        </defs>
        <rect width="200" height="140" fill="url(#lines)"/>
        <rect x="20" y="20" width="120" height="3" fill="#4285f4"/>
        <rect x="20" y="30" width="160" height="2" fill="#6c757d"/>
        <rect x="20" y="40" width="140" height="2" fill="#6c757d"/>
        <rect x="20" y="50" width="100" height="2" fill="#6c757d"/>
        <rect x="20" y="70" width="160" height="2" fill="#6c757d"/>
        <rect x="20" y="80" width="120" height="2" fill="#6c757d"/>
        <rect x="20" y="90" width="140" height="2" fill="#6c757d"/>
        <circle cx="170" cy="30" r="8" fill="#4285f4" opacity="0.2"/>
        <path d="M166 26 l8 8 M174 26 l-8 8" stroke="#4285f4" stroke-width="2" opacity="0.6"/>
      </svg>
    `
    return `data:image/svg+xml;base64,${btoa(svg)}`
  }

  export let onSelectTemplate: (_template: TemplateMetadata) => void

  let newTemplates: TemplateMetadata[] = []
  let isLoading = false
  let selectedTemplateId: string | null = null

  $: {
    const templateList = $templates as TemplateMetadata[]
    newTemplates = templateList?.filter(template => template.new) || []
  }

  // Function to get the appropriate image for a template
  const getTemplateImage = (template: TemplateMetadata): string => {
    // For DOCX templates without an image, use the custom document fallback
    if (
      template.key?.startsWith("docx/") &&
      (!template.image || template.image.trim() === "")
    ) {
      return createDocxFallbackImage()
    }
    // For all other templates, use the original image
    return template.image
  }

  // Function to check if template is a DOCX template
  const isDocxTemplate = (template: TemplateMetadata): boolean => {
    return template.key?.startsWith("docx/") || false
  }

  const handleSelectTemplate = async (template: TemplateMetadata) => {
    if (isLoading) return

    isLoading = true
    selectedTemplateId = template.key

    try {
      // For DOCX templates, ensure proper template structure for backend processing
      if (template.key && template.key.startsWith("docx/")) {
        const docxTemplate = {
          ...template,
          useTemplate: true,
          key: template.key,
        }
        await onSelectTemplate(docxTemplate)
      } else {
        await onSelectTemplate(template)
      }
    } catch (error) {
      isLoading = false
      selectedTemplateId = null
      throw error
    }
  }

  const handleAddNewTemplate = () => {
    // Show the DOCX upload modal
    docxUploadModal.show()
  }

  const handleTemplateUploaded = async () => {
    // Refresh the templates store to include the new template
    await templates.load()
    // Close the upload modal
    docxUploadModal.hide()
  }

  let docxUploadModal: Modal
</script>

<ModalContent
  title="Choose a starting template"
  size="XL"
  showCancelButton={false}
  showConfirmButton={false}
>
  <Layout noPadding gap="M">
    <div class="template-grid">
      {#each newTemplates as template}
        <button
          class="template-wrapper"
          class:loading={isLoading}
          class:selected={selectedTemplateId === template.key}
          class:docx-template={isDocxTemplate(template)}
          disabled={isLoading}
          on:click={() => handleSelectTemplate(template)}
        >
          <TemplateCard
            name={template.name}
            imageSrc={getTemplateImage(template)}
            backgroundColour={template.background}
            icon={template.icon}
            description={template.description}
            overlayEnabled={!isLoading}
            {isLoading}
            isSelected={selectedTemplateId === template.key}
          />
        </button>
      {/each}
    </div>
    <div class="add-template-container">
      <Button cta on:click={handleAddNewTemplate}>
        <div class="add-button-content">
          <Icon name="plus" />
          <span>Add new template</span>
        </div>
      </Button>
    </div>
  </Layout>
</ModalContent>

<Modal bind:this={docxUploadModal}>
  <DocxTemplateUploadModal on:template-uploaded={handleTemplateUploaded} />
</Modal>

<style>
  .template-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--spacing-l);
    padding: var(--spacing-m);
  }

  .template-wrapper {
    cursor: pointer;
    transition: transform 0.2s ease;
    background: none;
    border: none;
    padding: 0;
    text-align: left;
    font-family: var(--font-sans);
  }

  .template-wrapper:hover:not(.loading) {
    transform: translateY(-4px);
  }

  .template-wrapper.loading {
    cursor: default;
  }

  .template-wrapper.loading:not(.selected) {
    opacity: 0.5;
  }

  /* Add styles for the new template button */
  .add-template-container {
    display: flex;
    justify-content: flex-end;
    padding: var(--spacing-m) var(--spacing-m) 0 var(--spacing-m);
  }

  .add-button-content {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  /* Special styling for DOCX templates */
  .template-wrapper.docx-template {
    position: relative;
  }

  .template-wrapper.docx-template::before {
    content: "DOCX";
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(66, 133, 244, 0.9);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    z-index: 5;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
</style>
