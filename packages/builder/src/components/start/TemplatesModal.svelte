<script lang="ts">
  import { ModalContent, Layout, Button, Icon, Modal } from "@budibase/bbui"
  import TemplateCard from "@/components/common/TemplateCard.svelte"
  import DocxTemplateUploadModal from "./DocxTemplateUploadModal.svelte"
  import { templates } from "@/stores/portal"
  import type { TemplateMetadata } from "@budibase/types"

  export let onSelectTemplate: (_template: TemplateMetadata) => void

  let newTemplates: TemplateMetadata[] = []
  let isLoading = false
  let selectedTemplateId: string | null = null

  $: {
    const templateList = $templates as TemplateMetadata[]
    newTemplates = templateList?.filter(template => template.new) || []
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
          disabled={isLoading}
          on:click={() => handleSelectTemplate(template)}
        >
          <TemplateCard
            name={template.name}
            imageSrc={template.image}
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
</style>
