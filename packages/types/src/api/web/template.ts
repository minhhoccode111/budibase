export enum TemplateType {
  APP = "app",
}

export interface TemplateMetadata {
  background: string
  icon: string
  category: string
  description: string
  name: string
  url: string
  type: TemplateType
  key: string
  image: string
  new: boolean
  // DOCX template specific properties
  docxFile?: {
    key: string
    url: string
    originalName: string
    size: number
  }
  fields?: any[]
  parseResults?: any
  createdAt?: string
  createdBy?: string
}

export type FetchTemplateResponse = TemplateMetadata[]

export interface DownloadTemplateResponse {
  message: string
}
