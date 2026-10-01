import React from 'react'
import { Metadata } from 'next'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import NeuroacabativaClient from '@/components/Objects/Neuro/NeuroacabativaClient'

export const dynamic = 'force-dynamic'

type MetadataProps = {
  params: Promise<{ orgslug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params
  let orgName = 'Anti-Caos'
  try {
    const org = await getOrganizationContextInfo(params.orgslug, {
      revalidate: 120,
      tags: ['organizations'],
    })
    if (org?.name) orgName = org.name
  } catch {
    // Fallback gracioso em ambientes sem backend
  }
  return {
    title: 'Neuroacabativa — ' + orgName,
    description: 'O manual de uso do seu cérebro no trabalho.',
  }
}

const NeuroacabativaPage = async (props: any) => {
  const orgslug = (await props.params).orgslug

  return <NeuroacabativaClient orgslug={orgslug} />
}

export default NeuroacabativaPage
