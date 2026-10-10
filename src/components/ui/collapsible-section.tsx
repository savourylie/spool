"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CaretDown } from "@phosphor-icons/react";
import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
  StickerCardContent,
  StickerCardIcon,
} from "@/components/ui/card";

interface CollapsibleSectionProps {
  title: string;
  description: string;
  summary: ReactNode;
  icon: ReactNode;
  iconColor: "primary" | "secondary" | "tertiary" | "quaternary";
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  description,
  summary,
  icon,
  iconColor,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const shouldReduceMotion = useReducedMotion();

  const instant = { duration: 0 };
  const spring = { type: "spring" as const, stiffness: 300, damping: 20 };
  const contentSpring = { type: "spring" as const, stiffness: 300, damping: 25 };

  return (
    <StickerCard className="hover:rotate-0 hover:scale-100">
      <StickerCardIcon color={iconColor}>{icon}</StickerCardIcon>
      <StickerCardHeader>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-4 text-left"
          aria-expanded={isOpen}
        >
          <div className="min-w-0">
            <StickerCardTitle>{title}</StickerCardTitle>
            <StickerCardDescription>{description}</StickerCardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {summary}
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={shouldReduceMotion ? instant : spring}
            >
              <CaretDown weight="bold" className="size-5 text-muted-foreground" />
            </motion.div>
          </div>
        </button>
      </StickerCardHeader>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? instant : contentSpring}
            style={{ overflow: "hidden" }}
          >
            <StickerCardContent>{children}</StickerCardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </StickerCard>
  );
}
