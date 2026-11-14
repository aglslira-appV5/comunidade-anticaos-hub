'use client'

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { Breadcrumbs } from '@components/Objects/Breadcrumbs/Breadcrumbs'
import { CommunitySidebar } from '@components/Objects/Communities/CommunitySidebar'
import { CapaDaComunidade } from '@components/Objects/Communities/CapaDaComunidade'
import { MessageCircle } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import { CommunityActionsMobile } from '@components/Objects/Communities/CommunityActionsMobile'
import { DiscussionList } from '@components/Objects/Communities/DiscussionList'
import { CreateDiscussionModal } from '@components/Objects/Modals/Communities/CreateDiscussionModal'
import { Community } from '@services/communities/communities'
import { isRichContentAllowed } from '@components/Objects/Communities/richContent'
import { DiscussionWithAuthor } from '@services/communities/discussions'
import { useMediaQuery } from 'usehooks-ts'
import { useTrackView, AnalyticsEvent } from '@services/analytics'
import { nomeDaComunidade, descricaoDaComunidade } from '@/lib/comunidadeIdioma'

interface CommunityClientProps {
  community: Community
  initialDiscussions: DiscussionWithAuthor[]
  orgslug: string
  org_id: number
}

const CommunityClient = ({
  community,
  initialDiscussions,
  orgslug,
}: CommunityClientProps) => {
  const { t } = useTranslation()
  const [isCreateDiscussionModalOpen, setIsCreateDiscussionModalOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 768px)')
  const communityName = nomeDaComunidade(community, t)
  const communityDescription = descricaoDaComunidade(community, t)

  useTrackView(AnalyticsEvent.CommunityViewed, {
    is_public: community.public,
    initial_discussion_count: initialDiscussions.length,
  })

  return (
    <>
      <GeneralWrapperStyled>
        {/* Breadcrumbs */}
        <div className="pb-4">
          <Breadcrumbs items={[
            { label: t('communities.title'), href: getUriWithOrg(orgslug, '/communities'), icon: <MessageCircle size={14} /> },
            { label: communityName }
          ]} />
        </div>

        {/* 450 (André, 14/10): a foto da comunidade como capa, antes das abas. */}
        <CapaDaComunidade community={community} />

        {/* Forum Layout - Sidebar Left, Content Right */}
        <div className="flex flex-col md:flex-row gap-6 pt-2">
          {/* Left Sidebar - Community Info (Desktop only) */}
          <div className="hidden md:block w-full md:w-72 lg:w-80 flex-shrink-0">
            <div className="sticky top-24">
              <CommunitySidebar
                community={community}
                discussionCount={initialDiscussions.length}
                orgslug={orgslug}
                onCreateDiscussion={() => setIsCreateDiscussionModalOpen(true)}
              />
            </div>
          </div>

          {/* Main Content - Discussions Feed */}
          <div className="flex-1 min-w-0">
            {/* Mobile only shows community name */}
            <div className="md:hidden mb-4">
              <h1 className="text-xl font-bold text-gray-900">{communityName}</h1>
              {communityDescription && (
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                  {communityDescription}
                </p>
              )}
            </div>

            {/* Discussions List */}
            <div className="bg-white nice-shadow rounded-lg overflow-hidden">
              <DiscussionList
                communityUuid={community.community_uuid}
                orgslug={orgslug}
                onCreateClick={() => setIsCreateDiscussionModalOpen(true)}
                initialDiscussions={initialDiscussions}
              />
            </div>
          </div>
        </div>

        {/* Bottom padding for mobile action bar */}
        {isMobile && <div className="h-24" />}
      </GeneralWrapperStyled>

      {/* Mobile Actions Bar */}
      {isMobile && (
        <CommunityActionsMobile
          community={community}
          orgslug={orgslug}
          onCreateDiscussion={() => setIsCreateDiscussionModalOpen(true)}
        />
      )}

      {/* Modals */}
      <CreateDiscussionModal
        isOpen={isCreateDiscussionModalOpen}
        onClose={() => setIsCreateDiscussionModalOpen(false)}
        allowRichContent={isRichContentAllowed(community)}
        communityUuid={community.community_uuid}
        orgSlug={orgslug}
      />
    </>
  )
}

export default CommunityClient
