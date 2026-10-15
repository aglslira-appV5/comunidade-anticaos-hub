'use client'
// 450 (André, 14/10): a foto da comunidade (aba Miniatura do painel) vira uma capa no topo da página,
// antes das abas. Sem foto cadastrada, nada aparece.
// 450b (André, 14/10, "coloque esse banner, igual ao do linkedin"): a capa mostra a imagem INTEIRA, na
// proporção dela (sem recorte), para o banner largo do Movimento caber com a frase e os rostos.
import React from 'react'
import { Community } from '@services/communities/communities'
import { getCommunityThumbnailMediaDirectory } from '@services/media/media'
import { useOrg } from '@components/Contexts/OrgContext'
import { SafeImage } from '@components/Objects/SafeImage'

export function CapaDaComunidade({ community }: { community: Community }) {
  const org = useOrg() as any
  if (!community.thumbnail_image || !org?.org_uuid) return null
  const src = getCommunityThumbnailMediaDirectory(org.org_uuid, community.community_uuid, community.thumbnail_image)
  return (
    <div className="mb-4 rounded-lg overflow-hidden nice-shadow bg-gray-100">
      <SafeImage src={src} alt={community.name} className="block w-full h-auto" />
    </div>
  )
}

export default CapaDaComunidade
