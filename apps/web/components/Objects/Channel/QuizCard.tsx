'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ClipboardList, Clock, ListChecks, Timer } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import { Badge } from '@components/ui/badge'
import { Button } from '@components/ui/button'

export interface QuizCardData {
  id: number
  title: string
  description?: string | null
  quiz_type: string
  time_limit_minutes?: number | null
  subject?: string | null
  level?: string | null
  question_count: number
}

interface QuizCardProps {
  quiz: QuizCardData
  orgslug: string
}

// Exam card per docs/DESIGN_SYSTEM.md §13: title → subject/level chips →
// question count + estimated time → primary action. No progress indicator
// yet (would need per-user attempt history — that's Phase 6G's Results
// increment, not built here) so the action is always "Start", never
// "Resume"/"Review".
export default function QuizCard({ quiz, orgslug }: QuizCardProps) {
  const { t } = useTranslation()
  const href = getUriWithOrg(orgslug, `/quizzes/${quiz.id}`)
  const isExamPractice = quiz.quiz_type === 'exam_practice'

  return (
    <div className="flex flex-col bg-card rounded-lg border border-border overflow-hidden transition-shadow hover:shadow-lg hover:shadow-gray-300/15">
      <Link
        href={href}
        className="flex flex-col flex-1 p-4 gap-2 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-md bg-muted">
          {isExamPractice ? (
            <Timer className="text-primary" size={18} aria-hidden="true" />
          ) : (
            <ClipboardList className="text-primary" size={18} aria-hidden="true" />
          )}
        </div>

        <h3 className="text-[1.0625rem] font-semibold leading-tight text-foreground line-clamp-2">
          {quiz.title}
        </h3>

        <div className="flex flex-wrap gap-1.5">
          {quiz.subject && (
            <Badge variant="outline" className="text-[11px] font-normal">{quiz.subject}</Badge>
          )}
          {quiz.level && (
            <Badge variant="outline" className="text-[11px] font-normal">{quiz.level}</Badge>
          )}
          {isExamPractice && (
            <Badge variant="outline" className="text-[11px] font-normal gap-1">
              <Timer size={10} aria-hidden="true" />
              {t('quiz.card.examPractice', { defaultValue: 'Exam practice' })}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto pt-1">
          <span className="inline-flex items-center gap-1">
            <ListChecks size={12} aria-hidden="true" />
            {t('quiz.card.questionCount', {
              defaultValue: '{{count}} questions',
              count: quiz.question_count,
            })}
          </span>
          {quiz.time_limit_minutes && (
            <span className="inline-flex items-center gap-1">
              <Clock size={12} aria-hidden="true" />
              {t('quiz.card.timeLimit', { defaultValue: '{{minutes}} min', minutes: quiz.time_limit_minutes })}
            </span>
          )}
        </div>
      </Link>

      <div className="px-4 pb-4">
        <Button asChild size="sm" className="w-full">
          <Link href={href}>{t('quiz.card.start', { defaultValue: 'Start' })}</Link>
        </Button>
      </div>
    </div>
  )
}
