'use client'
// 450 (André, 14/10): a foto da comunidade (aba Miniatura do painel) vira uma capa no topo da página,
// antes das abas. No computador a faixa é 3 por 1, recortada um pouco acima do meio pra não cortar os
// rostos; no celular a foto aparece inteira (16 por 9). Sem foto cadastrada, nada aparece.
import React from 'react'
import { Community } from '@services/communities/communities'
import { getCommunityThumbnailMediaDirectory } from '@services/media/media'
import { useOrg } from '@components/Contexts/OrgContext'
import { SafeImage } from '@components/Objects/SafeImage'

export const ENQUADRAMENTO_DA_CAPA = '50% 28%'

export function CapaDaComunidade({ community }: { community: Community }) {
  const org = useOrg() as any
  if (!community.thumbnail_image || !org?.org_uuid) return null
  const src = getCommunityThumbnailMediaDirectory(org.org_uuid, community.community_uuid, community.thumbnail_image)
  return (
    <div className="mb-4 rounded-lg overflow-hidden nice-shadow bg-gray-100 aspect-video md:aspect-[3/1]">
      <SafeImage
        src={src}
        alt={community.name}
        className="w-full h-full object-cover"
        style={{ objectPosition: ENQUADRAMENTO_DA_CAPA }}
      />
    </div>
  )
}

export default CapaDaComunidade
