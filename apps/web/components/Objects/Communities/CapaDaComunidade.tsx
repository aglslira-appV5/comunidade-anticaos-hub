'use client'
// 450 (André, 14/10): a foto da comunidade (aba Miniatura do painel) vira uma capa no topo da página,
// antes das abas. Sem foto cadastrada, nada aparece.
// 450b (André, 14/10, "coloque esse banner, igual ao do linkedin"): a capa mostra a imagem INTEIRA, na
// proporção dela (sem recorte), para o banner largo do Movimento caber com a frase e os rostos.
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Community } from '@services/communities/communities'
import { getCommunityThumbnailMediaDirectory } from '@services/media/media'
import { useOrg } from '@components/Contexts/OrgContext'
import { SafeImage } from '@components/Objects/SafeImage'
import {
  ehComunidadeDoMovimento,
  nomeDaComunidade,
  palavrasPostItsCapa,
} from '@/lib/comunidadeIdioma'

const CORES_POSTIT = ['#F2E2B8', '#F4B95A', '#DDE7C7', '#CBE3EA']
const ROTACOES_POSTIT = ['-1.4deg', '1.1deg', '-0.7deg', '1.3deg', '-1.1deg', '0.8deg']

export function CapaDaComunidade({ community }: { community: Community }) {
  const org = useOrg() as any
  const { t, i18n } = useTranslation()
  if (!community.thumbnail_image || !org?.org_uuid) return null
  const src = getCommunityThumbnailMediaDirectory(org.org_uuid, community.community_uuid, community.thumbnail_image)
  const mostrarPostIts = ehComunidadeDoMovimento(community)
  const [palavra1, palavra2] = palavrasPostItsCapa(i18n.language)
  const altTexto = nomeDaComunidade(community, t) || community.name

  return (
    <div className="relative mb-4 rounded-lg overflow-hidden nice-shadow bg-gray-100">
      <SafeImage src={src} alt={altTexto} className="block w-full h-auto" />
      {mostrarPostIts && (
        <div
          aria-hidden="true"
          data-testid="capa-comunidade-postits"
          className="pointer-events-none select-none absolute inset-x-0 top-[54%] flex items-center justify-end pe-[3%] ps-[26%]"
        >
          <div className="flex items-center justify-end gap-[2.2%] w-full">
            {[palavra1, palavra2].map((palavra, wIdx) => (
              <div key={palavra} className="flex items-center gap-[3px] sm:gap-[5px]">
                {palavra.split('').map((letra, lIdx) => {
                  const idx = wIdx * 10 + lIdx
                  const cor = CORES_POSTIT[idx % CORES_POSTIT.length]
                  const rot = ROTACOES_POSTIT[idx % ROTACOES_POSTIT.length]
                  return (
                    <span
                      key={`${wIdx}-${lIdx}`}
                      style={{
                        backgroundColor: cor,
                        transform: `rotate(${rot})`,
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.24)',
                      }}
                      className="inline-flex items-center justify-center w-[15px] h-[16px] sm:w-[24px] sm:h-[26px] md:w-[30px] md:h-[32px] lg:w-[34px] lg:h-[36px] text-[10px] sm:text-[15px] md:text-[19px] lg:text-[22px] font-black leading-none text-neutral-900 rounded-[1px]"
                    >
                      {letra}
                    </span>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default CapaDaComunidade
