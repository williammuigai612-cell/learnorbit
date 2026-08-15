'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useFormik } from 'formik'
import * as Form from '@radix-ui/react-form'
import toast from 'react-hot-toast'
import { ArrowLeft, ArrowRight, Check, Info, Loader2, School, GraduationCap } from 'lucide-react'

import { useLHSession } from '@components/Contexts/LHSessionContext'
import { createNewOrganization } from '@services/organizations/orgs'
import { getUriWithOrg } from '@services/config/config'

// Kept in sync with apps/web/app/(hub)/new/page.tsx's RESERVED_SLUGS/RESTRICTED_WORDS —
// duplicated rather than imported so this minimal LearnOrbit flow stays independent of
// that file's SaaS onboarding wizard (billing plans, personal/org split) which does not
// apply to channel creation.
const RESERVED_SLUGS = ['learnhouse', 'graphicmade', 'sweave', 'cname']
const RESTRICTED_WORDS = ['sex', 'test']

type ChannelType = 'SCHOOL' | 'INSTRUCTOR'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20)
}

// Mirrors apps/web/app/(hub)/new/page.tsx's friendlyCreateError — never leak a raw
// FastAPI validation payload into the UI.
function friendlyCreateError(e: any, fallback: string): string {
  const detail = e?.detail
  if (Array.isArray(detail)) {
    const first = detail[0]
    const field = Array.isArray(first?.loc) ? first.loc[first.loc.length - 1] : undefined
    if (field && first?.msg) return `${String(field)}: ${first.msg}`
    return fallback
  }
  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string') return detail.message
    return fallback
  }
  const msg = typeof e?.message === 'string' ? e.message.trim() : ''
  if (!msg || msg.startsWith('[') || msg.startsWith('{')) return fallback
  return msg
}

function ChannelTypeCard({
  selected,
  onClick,
  Icon,
  title,
  subtitle,
}: {
  selected: boolean
  onClick: () => void
  Icon: React.ElementType
  title: string
  subtitle: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-start px-6 py-6 rounded-2xl transition-all duration-150 cursor-pointer flex flex-col
        ${selected ? 'bg-gray-900 ring-2 ring-gray-900 shadow-lg shadow-gray-900/20' : 'bg-white nice-shadow hover:shadow-lg hover:shadow-gray-200/60'}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${selected ? 'bg-white/10' : 'bg-gray-50'}`}>
          <Icon size={22} className={selected ? 'text-white' : 'text-gray-500'} />
        </div>
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center shadow-sm transition-opacity ${selected ? 'bg-white opacity-100' : 'opacity-0'}`}
        >
          <Check size={11} className="text-gray-900" />
        </div>
      </div>
      <div className={`font-black text-lg tracking-tight leading-tight mb-1 ${selected ? 'text-white' : 'text-gray-900'}`}>
        {title}
      </div>
      <p className={`text-xs leading-relaxed ${selected ? 'text-white/50' : 'text-gray-400'}`}>{subtitle}</p>
    </button>
  )
}

const FormLabelAndMessage = ({ label, message }: { label: string; message?: string }) => (
  <div className="flex items-center justify-between mb-2">
    <Form.Label className="text-[13px] font-semibold text-black/50">{label}</Form.Label>
    {message && (
      <div className="flex items-center gap-1 text-red-500/80 text-[11px] font-medium">
        <Info size={9} />
        <span>{message}</span>
      </div>
    )}
  </div>
)

export default function NewChannelPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const isAuthenticated = session?.status === 'authenticated'
  const isLoading = session?.status === 'loading'

  const [channelType, setChannelType] = useState<ChannelType | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const slugEdited = useRef(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isLoading, isAuthenticated, router])

  const validate = (values: any) => {
    const errors: any = {}
    if (!values.name) errors.name = t('new_channel.validation.required', { defaultValue: 'Required' })
    if (!values.slug) errors.slug = t('new_channel.validation.required', { defaultValue: 'Required' })
    else if (values.slug !== values.slug.toLowerCase())
      errors.slug = t('new_channel.validation.lowercase', { defaultValue: 'Lowercase only' })
    else if (values.slug.match(/[^a-z0-9-]/))
      errors.slug = t('new_channel.validation.noSpecialChars', { defaultValue: 'Letters, numbers, dashes only' })
    else if (RESERVED_SLUGS.includes(values.slug) || RESTRICTED_WORDS.some((w) => values.slug.includes(w)))
      errors.slug = t('new_channel.validation.reserved', { defaultValue: 'This slug is reserved' })
    else if (values.slug.length > 20)
      errors.slug = t('new_channel.validation.maxLength', { defaultValue: 'Max 20 characters' })
    return errors
  }

  const formik = useFormik({
    initialValues: { name: '', description: '', slug: '' },
    validate,
    onSubmit: async (values) => {
      if (!channelType || submitting) return
      setSubmitting(true)
      setError('')
      try {
        const newOrg = await createNewOrganization(
          {
            name: values.name,
            description: values.description,
            slug: values.slug,
            email: session?.data?.user?.email ?? '',
            logo_image: '',
            channel_type: channelType,
          },
          access_token
        )
        const newSlug = newOrg?.slug ?? values.slug
        toast.success(t('new_channel.toast.created', { defaultValue: 'Channel created!' }))
        window.location.href = getUriWithOrg(newSlug, '/')
      } catch (e: any) {
        const fallback = t('new_channel.toast.failed', { defaultValue: 'Failed to create channel' })
        const msg = friendlyCreateError(e, fallback)
        toast.error(msg)
        setError(msg)
        setSubmitting(false)
      }
    },
  })

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    formik.handleChange(e)
    if (!slugEdited.current) {
      formik.setFieldValue('slug', slugify(e.target.value))
    }
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    slugEdited.current = true
    formik.handleChange(e)
  }

  const inputCls =
    'w-full bg-white nice-shadow text-[14px] text-black/80 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/[0.06] transition-all placeholder:text-black/20'
  const hasErrors = Object.keys(formik.errors).length > 0
  const canSubmit = channelType !== null && !hasErrors && !submitting

  const showLoader = isLoading || (isAuthenticated && !session?.data)

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
      <div className="relative min-h-screen flex flex-col items-center py-8 px-4">
        <div className="w-full max-w-xl mb-10 grid grid-cols-3 items-center">
          <Link
            href="/home"
            className="flex items-center gap-1.5 text-sm font-semibold text-black/35 hover:text-black transition-colors w-fit"
          >
            <ArrowLeft size={14} />
            {t('new_channel.topBar.back', { defaultValue: 'Channels' })}
          </Link>
          <div className="flex justify-center">
            <Link href="/home">
              <img src="/lrn.svg" alt="LearnOrbit" width={40} height={40} className="opacity-90" />
            </Link>
          </div>
          <div />
        </div>

        <div className="w-full max-w-xl">
          {showLoader ? (
            <div className="space-y-3">
              <div className="h-40 w-full rounded-2xl bg-black/[0.03] animate-pulse" />
              <div className="h-40 w-full rounded-2xl bg-black/[0.03] animate-pulse" />
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
                  {t('new_channel.title', { defaultValue: 'Create your channel' })}
                </h1>
                <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
                  {t('new_channel.subtitle', { defaultValue: 'Are you a school or a teacher/creator?' })}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <ChannelTypeCard
                  selected={channelType === 'SCHOOL'}
                  onClick={() => setChannelType('SCHOOL')}
                  Icon={School}
                  title={t('new_channel.type.school.title', { defaultValue: 'School / Institution' })}
                  subtitle={t('new_channel.type.school.subtitle', {
                    defaultValue: 'An academic institution publishing content under one name.',
                  })}
                />
                <ChannelTypeCard
                  selected={channelType === 'INSTRUCTOR'}
                  onClick={() => setChannelType('INSTRUCTOR')}
                  Icon={GraduationCap}
                  title={t('new_channel.type.instructor.title', { defaultValue: 'Teacher / Educational Creator' })}
                  subtitle={t('new_channel.type.instructor.subtitle', {
                    defaultValue: 'An individual educator building their own audience.',
                  })}
                />
              </div>

              <div className="bg-white nice-shadow rounded-2xl p-7">
                {error && (
                  <div className="flex items-center gap-2.5 bg-red-50 rounded-xl px-4 py-3 mb-5 text-red-600 border border-red-100">
                    <Info size={14} className="flex-shrink-0" />
                    <span className="text-[13px] font-medium">{error}</span>
                  </div>
                )}
                <Form.Root onSubmit={formik.handleSubmit} className="space-y-5">
                  <Form.Field name="name">
                    <FormLabelAndMessage
                      label={t('new_channel.fields.name', { defaultValue: 'Channel name' })}
                      message={formik.errors.name as string}
                    />
                    <Form.Control asChild>
                      <input
                        className={inputCls}
                        onChange={handleNameChange}
                        value={formik.values.name}
                        type="text"
                        placeholder={t('new_channel.placeholders.name', { defaultValue: 'Nairobi Academy' })}
                        required
                      />
                    </Form.Control>
                  </Form.Field>

                  <Form.Field name="description">
                    <FormLabelAndMessage label={t('new_channel.fields.description', { defaultValue: 'Description (optional)' })} />
                    <Form.Control asChild>
                      <input
                        className={inputCls}
                        onChange={formik.handleChange}
                        value={formik.values.description}
                        type="text"
                        placeholder={t('new_channel.placeholders.description', {
                          defaultValue: 'What does your channel teach?',
                        })}
                      />
                    </Form.Control>
                  </Form.Field>

                  <Form.Field name="slug">
                    <FormLabelAndMessage
                      label={t('new_channel.fields.slug', { defaultValue: 'Address' })}
                      message={formik.errors.slug as string}
                    />
                    <div className="flex items-center rounded-xl overflow-hidden nice-shadow focus-within:ring-2 focus-within:ring-black/[0.06] transition-all">
                      <Form.Control asChild>
                        <input
                          className="flex-1 bg-white text-[14px] text-black/80 px-4 py-3 focus:outline-none placeholder:text-black/20"
                          onChange={handleSlugChange}
                          value={formik.values.slug}
                          placeholder="your-channel"
                          type="text"
                          required
                        />
                      </Form.Control>
                      <span className="px-4 py-3 bg-gray-50 text-black/25 border-s border-gray-100 shrink-0 text-[13px] font-medium select-none">
                        .learnorbit.io
                      </span>
                    </div>
                  </Form.Field>

                  <Form.Submit asChild>
                    <button
                      disabled={!canSubmit}
                      className={`w-full flex items-center justify-center gap-2 text-[14px] font-semibold py-3 rounded-xl transition-colors mt-1 ${
                        !canSubmit
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-900 hover:bg-gray-800 text-white cursor-pointer'
                      }`}
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          {t('new_channel.submitting', { defaultValue: 'Creating…' })}
                        </>
                      ) : (
                        <>
                          {t('new_channel.submit', { defaultValue: 'Create channel' })}
                          <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  </Form.Submit>
                  {!channelType && (
                    <p className="text-center text-xs text-gray-400">
                      {t('new_channel.pickTypeHint', { defaultValue: 'Choose a channel type above to continue.' })}
                    </p>
                  )}
                </Form.Root>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
