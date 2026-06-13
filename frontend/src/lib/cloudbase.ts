import cloudbase from '@cloudbase/js-sdk'

const cloudbaseEnvId = import.meta.env.VITE_CLOUDBASE_ENV_ID
const cloudbaseAccessKey = import.meta.env.VITE_CLOUDBASE_ACCESS_KEY
const cloudbaseRegion = import.meta.env.VITE_CLOUDBASE_REGION || 'ap-shanghai'

if (!cloudbaseEnvId) {
  console.error('Missing VITE_CLOUDBASE_ENV_ID')
}

export const cloudbaseApp = cloudbase.init({
  env: cloudbaseEnvId ?? '',
  region: cloudbaseRegion,
  accessKey: cloudbaseAccessKey || undefined,
  auth: {
    detectSessionInUrl: true,
  },
})

export const cloudbaseAuth = cloudbaseApp.auth

export async function getCloudbaseAccessToken(): Promise<string | null> {
  const { data, error } = await cloudbaseAuth.getSession()
  if (error) throw error
  return data.session?.access_token ?? null
}
