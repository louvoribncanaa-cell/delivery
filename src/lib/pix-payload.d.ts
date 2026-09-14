declare module 'pix-payload' {
  export interface PixPayloadInput {
    key: string
    name: string
    city: string
    amount?: number
    transactionId?: string
  }

  export function payload(input: PixPayloadInput): string
}
