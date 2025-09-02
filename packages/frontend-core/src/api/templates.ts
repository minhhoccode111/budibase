import {
  FetchGlobalTemplateByTypeResponse,
  FetchGlobalTemplateDefinitionResponse,
  FetchTemplateResponse,
  SaveGlobalTemplateRequest,
  SaveGlobalTemplateResponse,
} from "@budibase/types"
import { BaseAPIClient } from "./types"

export interface TemplateEndpoints {
  getEmailTemplates: () => Promise<FetchGlobalTemplateByTypeResponse>
  getAppTemplates: () => Promise<FetchTemplateResponse>
  getEmailTemplateDefinitions: () => Promise<FetchGlobalTemplateDefinitionResponse>
  saveEmailTemplate: (
    template: SaveGlobalTemplateRequest
  ) => Promise<SaveGlobalTemplateResponse>
  uploadDocxTemplate: (formData: FormData) => Promise<any>
}

export const buildTemplateEndpoints = (
  API: BaseAPIClient
): TemplateEndpoints => ({
  /**
   * Gets the list of email template definitions.
   */
  getEmailTemplateDefinitions: async () => {
    return await API.get({ url: "/api/global/template/definitions" })
  },

  /**
   * Gets the list of email templates.
   */
  getEmailTemplates: async () => {
    return await API.get({
      url: "/api/global/template/email",
    })
  },

  /**
   * Saves an email template.
   * @param template the template to save
   */
  saveEmailTemplate: async template => {
    return await API.post({
      url: "/api/global/template",
      body: template,
    })
  },

  /**
   * Gets a list of app templates.
   */
  getAppTemplates: async () => {
    return await API.get({
      url: "/api/templates",
    })
  },

  /**
   * Uploads a DOCX template.
   * @param formData the form data containing the DOCX file and metadata
   */
  uploadDocxTemplate: async (formData: FormData) => {
    return await API.post({
      url: "/api/templates/docx",
      body: formData,
      json: false, // Don't JSON stringify FormData
    })
  },
})
