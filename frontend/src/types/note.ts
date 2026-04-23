export type Note = {
  id: string
  title: string
  content: string
  isPublished: boolean
  createdAt: string
  updatedAt: string
}

export type NotePayload = {
  title: string
  content: string
  isPublished: boolean
}
