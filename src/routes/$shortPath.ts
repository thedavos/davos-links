import { createFileRoute } from '@tanstack/react-router'
import { handlePublicRedirect } from '../lib/redirect/handler'

export const Route = createFileRoute('/$shortPath')({
  server: {
    handlers: {
      GET: async ({
        request,
        context,
      }: {
        request: Request
        context?: { cloudflare?: { ctx?: ExecutionContext } }
      }) => handlePublicRedirect(request, context?.cloudflare?.ctx),
    },
  },
})
