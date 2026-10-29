'use client'
import { useFormik } from 'formik'
import { useRouter } from 'next/navigation'
import React, { useEffect } from 'react'
import FormLayout, {
  FormField,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { AlertTriangle, Info, Mail, User } from 'lucide-react'
import Link from 'next/link'
import { signUpWithInviteCode } from '@services/auth/auth'
import { useOrg } from '@components/Contexts/OrgContext'
import { signIn } from '@components/Contexts/AuthContext'
import { getLEARNHOUSE_TOP_DOMAIN_VAL, isOnCustomDomain } from '@services/config/config'
import { getErrorMessage } from '@services/utils/ts/errorMessage'
import { useTranslation } from 'react-i18next'
import { PasswordStrengthIndicator, validatePasswordStrength } from '@components/Auth/PasswordStrengthIndicator'
import CampoSenha from '@components/Auth/CampoSenha'
import TurnstileWidget, { useTurnstileRequired, type TurnstileWidgetHandle } from '@components/Auth/TurnstileWidget'
import { useLHAnalytics, AnalyticsEvent } from '@services/analytics'
import CustomSignupFields, {
  initialCustomFieldValues,
  validateCustomFields,
} from '@components/Auth/CustomSignupFields'
import { readSignupFields, type SignupFieldItem } from '@services/settings/org'

const validate = (values: any, t: any, customFields: SignupFieldItem[]) => {
  const errors: any = {}

  if (!values.email) {
    errors.email = t('validation.required')
  } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
    errors.email = t('validation.invalid_email')
  }

  if (!values.password) {
    errors.password = t('validation.required')
  } else {
    const passwordValidation = validatePasswordStrength(values.password)
    if (!passwordValidation.isValid) {
      errors.password = t('auth.password_requirements_not_met')
    }
  }

  if (!values.username) {
    errors.username = t('validation.required')
  } else if (values.username.length < 4) {
    errors.username = t('validation.username_min_length')
  }

  // Bio is optional - no validation required

  // The org's admin-defined fields. Client-side only; the server revalidates.
  const customFieldErrors = validateCustomFields(customFields, values.custom_fields, t)
  if (Object.keys(customFieldErrors).length > 0) {
    errors.custom_fields = customFieldErrors
  }

  return errors
}

interface InviteOnlySignUpProps {
  inviteCode: string
  org?: any
}

function InviteOnlySignUpComponent(props: InviteOnlySignUpProps) {
  const { t } = useTranslation()
  const { track } = useLHAnalytics('public')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  // Prefer the client OrgContext, but fall back to the server-provided org so the
  // OAuth org cookies get written even during the react-query load window (an
  // invite link opened cold) — otherwise a Google sign-up lands org-less instead
  // of joined to the invited org. Mirrors OpenSignup.
  const contextOrg = useOrg() as any
  const org = (contextOrg && (contextOrg.id || contextOrg.slug)) ? contextOrg : props.org
  const _router = useRouter()
  const [error, setError] = React.useState('')
  const [message, setMessage] = React.useState<{ email_verified: boolean } | null>(null)
  const turnstileRef = React.useRef<TurnstileWidgetHandle>(null)
  const turnstileRequired = useTurnstileRequired()
  // Field definitions ship with the org config the page already loaded, so no
  // extra request is needed to render them.
  const customFields = React.useMemo<SignupFieldItem[]>(
    () => readSignupFields(org),
    [org],
  )
  const formik = useFormik({
    initialValues: {
      org_slug: org?.slug,
      org_id: org?.id,
      email: '',
      password: '',
      username: '',
      bio: '',
      first_name: '',
      last_name: '',
      custom_fields: initialCustomFieldValues(customFields),
      turnstileToken: null as string | null,
    },
    validate: (values) => validate(values, t, customFields),
    enableReinitialize: true,
    onSubmit: async (values) => {
      setError('')
      setMessage(null)
      setIsSubmitting(true)
      track(AnalyticsEvent.SignupSubmitted, { invite_code_present: true, has_bio: !!values.bio })
      try {
        let res = await signUpWithInviteCode(values, props.inviteCode)
        let message = await res.json().catch(() => ({}))
        if (res.status == 200) {
          track(AnalyticsEvent.SignupSucceeded, { email_verified: message.email_verified })
          setMessage(message)
        } else {
          // Surface the backend's actual detail for ANY non-2xx instead of
          // masking everything past a few statuses behind a generic message.
          track(AnalyticsEvent.SignupFailed, { status_code: res.status })
          setError(getErrorMessage(message?.detail, t('common.something_went_wrong')))
          // Turnstile tokens are single-use — fetch a fresh one for the retry.
          turnstileRef.current?.reset()
        }
      } catch (err) {
        // A network throw must not leave the form permanently locked.
        setError(getErrorMessage((err as any)?.detail, t('common.something_went_wrong')))
        turnstileRef.current?.reset()
      } finally {
        setIsSubmitting(false)
      }
    },
  })

  useEffect(() => { }, [org])

  // Honor a sanitized ?next / ?redirect destination through the
  // cross-domain /redirect_from_auth handoff; default to /home.
  const buildCallbackUrl = () => {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('next') ?? params.get('redirect')
    const dest = raw && /^\/(?!\/)/.test(raw) ? raw : '/home'
    return `${window.location.origin}/redirect_from_auth?next=${encodeURIComponent(dest)}`
  }

  const handleGoogleSignIn = () => {
    // Store org context in cookies before OAuth redirect
    if (org?.slug) {
      const topDomain = getLEARNHOUSE_TOP_DOMAIN_VAL();
      const isSecure = window.location.protocol === 'https:';
      const secureAttr = isSecure ? '; secure' : '';
      const baseAttributes = `; path=/; SameSite=Lax${secureAttr}`;
      // Host-only on custom domains (a .{platformTopDomain} cookie can't be set
      // from learn.acme.org → browser drops it → callback loses org context).
      const domainAttr = (topDomain === 'localhost' || isOnCustomDomain()) ? '' : `; domain=.${topDomain}`;
      document.cookie = `LH_oauth_orgslug=${org.slug}${baseAttributes}${domainAttr}`;
      document.cookie = `LH_oauth_org_id=${org.id}${baseAttributes}${domainAttr}`;
      // Invite-only orgs need the invite code itself, not just the org: the
      // backend requires the same proof the form signup posts to
      // /users/{org_id}/invite/{code}. Without it a Google sign-up through an
      // invite link is refused instead of joining the org.
      if (props.inviteCode) {
        document.cookie = `LH_oauth_invite_code=${encodeURIComponent(props.inviteCode)}${baseAttributes}${domainAttr}`;
      }
    }
    // Use absolute URL with current origin for custom domain support
    signIn('google', { callbackUrl: buildCallbackUrl() });
  };

  return (
    <div className="w-full max-w-[420px] py-10">
      {/* Header */}
      <h1 className="text-[28px] md:text-[32px] font-black text-black tracking-tight leading-tight">{t('auth.create_account')}</h1>
      <p className="mt-2 text-black/45 text-[15px] font-medium">{t('auth.fill_in_details')}</p>

      <div className="mt-8">
        {/* Error/Success Messages */}
        {error && (
          <div className="flex justify-center bg-red-50 rounded-xl text-red-600 space-x-2 items-center p-4 mb-6 border border-red-100">
            <AlertTriangle size={18} className="shrink-0" />
            <div className="font-medium text-sm">{error}</div>
          </div>
        )}

        {message && message.email_verified === false && (
          <div className="flex flex-col gap-4 bg-green-50 rounded-xl text-green-700 p-4 mb-6 border border-green-100">
            <div className="flex items-center gap-2">
              <Mail size={18} />
              <div className="font-semibold text-sm">{t('auth.check_email_for_verification')}</div>
            </div>
            <p className="text-xs text-green-600">
              {t('auth.verification_email_sent_message')}
            </p>
            <hr className="border-green-100" />
            <Link className="flex items-center gap-2 text-sm font-medium hover:underline" href="/login">
              <User size={14} />
              <span>{t('auth.login')}</span>
            </Link>
          </div>
        )}

        {message && message.email_verified && (
          <div className="flex flex-col gap-4 bg-green-50 rounded-xl text-green-700 p-4 mb-6 border border-green-100">
            <div className="flex items-center gap-2">
              <Mail size={18} />
              <div className="font-semibold text-sm">{t('auth.account_created_success')}</div>
            </div>
            <hr className="border-green-100" />
            <Link className="flex items-center gap-2 text-sm font-medium hover:underline" href="/login">
              <User size={14} />
              <span>{t('auth.login')}</span>
            </Link>
          </div>
        )}

        <FormLayout onSubmit={formik.handleSubmit}>
          <FormField name="email">
            <div className="flex items-center space-x-2 mb-1.5">
              <Form.Label className="grow text-[13px] font-semibold text-black/70">{t('auth.email')}</Form.Label>
              {formik.touched.email && formik.errors.email && (
                <span className="text-red-500 text-xs flex items-center space-x-1">
                  <Info size={11} />
                  <span>{formik.errors.email}</span>
                </span>
              )}
            </div>
            <Form.Control asChild>
              <input
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                value={formik.values.email}
                type="email"
                required
                className="box-border w-full bg-neutral-50 text-black rounded-lg px-4 border border-neutral-200 inline-flex h-[44px] appearance-none items-center focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all placeholder:text-black/25 text-sm"
              />
            </Form.Control>
          </FormField>

          <div className="flex flex-row space-x-2">
            <FormField name="first_name">
              <div className="flex items-center space-x-2 mb-1.5">
                <Form.Label className="grow text-[13px] font-semibold text-black/70">{t('user.first_name')}</Form.Label>
                {formik.touched.first_name && formik.errors.first_name && (
                  <span className="text-red-500 text-xs flex items-center space-x-1">
                    <Info size={11} />
                    <span>{formik.errors.first_name}</span>
                  </span>
                )}
              </div>
              <Form.Control asChild>
                <input
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.first_name}
                  type="text"
                  className="box-border w-full bg-neutral-50 text-black rounded-lg px-4 border border-neutral-200 inline-flex h-[44px] appearance-none items-center focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all placeholder:text-black/25 text-sm"
                />
              </Form.Control>
            </FormField>
            <FormField name="last_name">
              <div className="flex items-center space-x-2 mb-1.5">
                <Form.Label className="grow text-[13px] font-semibold text-black/70">{t('user.last_name')}</Form.Label>
                {formik.touched.last_name && formik.errors.last_name && (
                  <span className="text-red-500 text-xs flex items-center space-x-1">
                    <Info size={11} />
                    <span>{formik.errors.last_name}</span>
                  </span>
                )}
              </div>
              <Form.Control asChild>
                <input
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  value={formik.values.last_name}
                  type="text"
                  className="box-border w-full bg-neutral-50 text-black rounded-lg px-4 border border-neutral-200 inline-flex h-[44px] appearance-none items-center focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all placeholder:text-black/25 text-sm"
                />
              </Form.Control>
            </FormField>
          </div>

          <FormField name="password">
            <div className="flex items-center space-x-2 mb-1.5">
              <Form.Label className="grow text-[13px] font-semibold text-black/70">{t('auth.password')}</Form.Label>
              {formik.touched.password && formik.errors.password && (
                <span className="text-red-500 text-xs flex items-center space-x-1">
                  <Info size={11} />
                  <span>{formik.errors.password}</span>
                </span>
              )}
            </div>
            <Form.Control asChild>
              <CampoSenha
                name="password"
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                value={formik.values.password}
                autoComplete="new-password"
                required
                className="box-border w-full bg-neutral-50 text-black rounded-lg px-4 border border-neutral-200 inline-flex h-[44px] appearance-none items-center focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all placeholder:text-black/25 text-sm"
              />
            </Form.Control>
            <PasswordStrengthIndicator password={formik.values.password} />
          </FormField>

          <FormField name="username">
            <div className="flex items-center space-x-2 mb-1.5">
              <Form.Label className="grow text-[13px] font-semibold text-black/70">{t('user.username')}</Form.Label>
              {formik.touched.username && formik.errors.username && (
                <span className="text-red-500 text-xs flex items-center space-x-1">
                  <Info size={11} />
                  <span>{formik.errors.username}</span>
                </span>
              )}
            </div>
            <Form.Control asChild>
              <input
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                value={formik.values.username}
                type="text"
                required
                className="box-border w-full bg-neutral-50 text-black rounded-lg px-4 border border-neutral-200 inline-flex h-[44px] appearance-none items-center focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all placeholder:text-black/25 text-sm"
              />
            </Form.Control>
          </FormField>

          <FormField name="bio">
            <div className="flex items-center space-x-2 mb-1.5">
              <Form.Label className="grow text-[13px] font-semibold text-black/70">{`${t('user.bio')} (${t('common.optional')})`}</Form.Label>
            </div>
            <Form.Control asChild>
              <textarea
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                value={formik.values.bio}
                placeholder={t('user.bio_placeholder')}
                className="box-border w-full bg-neutral-50 text-black rounded-lg px-4 py-3 border border-neutral-200 appearance-none focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-neutral-400 transition-all placeholder:text-black/25 text-sm resize-none min-h-[80px]"
              />
            </Form.Control>
          </FormField>

          <CustomSignupFields fields={customFields} formik={formik} />

          <TurnstileWidget
            ref={turnstileRef}
            onToken={(token) => formik.setFieldValue('turnstileToken', token)}
            className="mt-2 flex justify-center"
          />

          <Form.Submit asChild>
            <button
              disabled={isSubmitting || !!message || (turnstileRequired && !formik.values.turnstileToken)}
              className="box-border w-full inline-flex h-[44px] rounded-lg items-center justify-center bg-black hover:bg-black/85 text-white px-[15px] font-bold text-[14px] leading-none mt-2 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center space-x-2">
                  <span className="w-4 h-4 border-t-2 border-white rounded-full animate-spin" />
                  <span>{t('common.loading')}</span>
                </span>
              ) : (
                t('auth.create_account_and_join')
              )}
            </button>
          </Form.Submit>
        </FormLayout>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 text-black/30 bg-white text-xs font-medium">{t('common.or')}</span>
          </div>
        </div>

        {/* Google Sign In */}
        <div>
          <button
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="flex justify-center items-center w-full bg-white hover:bg-neutral-50 text-black space-x-3 font-medium p-3 rounded-lg border border-neutral-200 transition-all text-sm disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            <span>{t('auth.sign_in_with_google')}</span>
          </button>
          <p className="text-xs text-black/40 text-center mt-1.5">
            {t('auth.google_same_email')}
          </p>
        </div>

        {/* Login Link */}
        <p className="text-center text-sm text-black/35 mt-6">
          {t('auth.already_have_account')}{' '}
          <Link href="/login" className="text-black font-semibold hover:underline">
            {t('auth.login')}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default InviteOnlySignUpComponent
