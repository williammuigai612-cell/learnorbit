import Image from 'next/image'
import lrnTextLogo from '@public/lrn-text.svg'
import React from 'react'
import { useOrg } from '../Contexts/OrgContext'
import { useTranslation } from 'react-i18next'
import { usePlan } from '@components/Hooks/usePlan'
import { getDeploymentMode } from '@services/config/config'

function Watermark() {
    const { t } = useTranslation()
    const org = useOrg() as any

    const mode = getDeploymentMode()
    const plan = usePlan()
    const watermarkConfig = org?.config?.config?.customization?.general?.watermark ?? org?.config?.config?.general?.watermark

    // Visibility rules, in priority order:
    //   1. EE         → always hidden (white-label is part of the EE license).
    //   2. SaaS free  → always shown (free tier is branded).
    //   3. Otherwise  → respect the admin's toggle (default on).
    if (mode === 'ee') return null
    const showWatermark = plan === 'free' || watermarkConfig !== false
    if (!showWatermark) return null

    return (
        <div className='fixed bottom-20 lg:bottom-8 end-8 z-50'>
            {/* Badge only — the learnhouse.app destination was removed and
                LearnOrbit has no marketing site yet. Re-wrap in a <Link> once
                a real URL exists. */}
            <div className="flex items-center bg-white/80 backdrop-blur-lg text-gray-700 rounded-2xl p-2 light-shadow text-xs px-5 font-semibold space-x-2">
                <p>{t('common.made_with')}</p>
                <Image unoptimized src={lrnTextLogo} alt="LearnOrbit" quality={100} width={95} />
            </div>
        </div>
    )
}

export default Watermark