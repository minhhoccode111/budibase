export const API = {
  // ... existing methods

  parseDocumentStructure: async (formData) => {
    const response = await post("/api/documents/parse", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })
    return await response.json()
  },

  generateBudibaseTemplate: async (templateData) => {
    const response = await post("/api/documents/generate-template", templateData)
    return await response.json()
  },
}