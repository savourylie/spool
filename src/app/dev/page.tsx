import { Star } from "@phosphor-icons/react/dist/ssr/Star"
import { Lightning } from "@phosphor-icons/react/dist/ssr/Lightning"
import { Heart } from "@phosphor-icons/react/dist/ssr/Heart"

import { Button } from "@/components/ui/button"
import {
  StickerCard,
  StickerCardHeader,
  StickerCardTitle,
  StickerCardDescription,
  StickerCardContent,
  StickerCardFooter,
  StickerCardIcon,
} from "@/components/ui/card"
import {
  Input,
  FormField,
  FormLabel,
  FormControl,
  FormDescription,
} from "@/components/ui/input"

export default function DevPage() {
  return (
    <div className="min-h-screen bg-background p-8 md:p-16">
      <div className="mx-auto max-w-4xl space-y-16">
        <h1 className="font-heading text-4xl font-medium">
          Component Preview
        </h1>

        {/* ---- Buttons ---- */}
        <section className="space-y-6">
          <h2 className="font-heading text-2xl font-medium">Buttons</h2>

          <div className="flex flex-wrap items-center gap-4">
            <Button>Candy Button</Button>
            <Button trailingIcon>Get Started</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Button variant="outline">Outline</Button>
            <Button variant="outline" disabled>Outline Disabled</Button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link Button</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
        </section>

        {/* ---- Cards ---- */}
        <section className="space-y-6">
          <h2 className="font-heading text-2xl font-medium">Sticker Cards</h2>

          <div className="grid gap-8 pt-8 md:grid-cols-3">
            <StickerCard>
              <StickerCardHeader>
                <StickerCardTitle>Default Card</StickerCardTitle>
                <StickerCardDescription>
                  Soft shadow, hover to wiggle.
                </StickerCardDescription>
              </StickerCardHeader>
              <StickerCardContent>
                <p className="text-sm">
                  Card content goes here. The shadow is subtle slate.
                </p>
              </StickerCardContent>
              <StickerCardFooter>
                <Button size="sm">Action</Button>
              </StickerCardFooter>
            </StickerCard>

            <StickerCard featured>
              <StickerCardHeader>
                <StickerCardTitle>Featured Card</StickerCardTitle>
                <StickerCardDescription>
                  Pink shadow for emphasis.
                </StickerCardDescription>
              </StickerCardHeader>
              <StickerCardContent>
                <p className="text-sm">
                  This card uses the featured pink hard shadow.
                </p>
              </StickerCardContent>
              <StickerCardFooter>
                <Button size="sm" trailingIcon>
                  Learn More
                </Button>
              </StickerCardFooter>
            </StickerCard>

            <StickerCard className="pt-8">
              <StickerCardIcon color="quaternary">
                <Star weight="fill" className="size-5" />
              </StickerCardIcon>
              <StickerCardHeader>
                <StickerCardTitle>With Icon</StickerCardTitle>
                <StickerCardDescription>
                  Floating icon circle above the border.
                </StickerCardDescription>
              </StickerCardHeader>
              <StickerCardContent>
                <p className="text-sm">
                  The icon sits half outside the card.
                </p>
              </StickerCardContent>
            </StickerCard>
          </div>

          <div className="grid gap-8 pt-8 md:grid-cols-3">
            <StickerCard className="pt-8">
              <StickerCardIcon color="primary">
                <Lightning weight="fill" className="size-5" />
              </StickerCardIcon>
              <StickerCardHeader>
                <StickerCardTitle>Primary Icon</StickerCardTitle>
              </StickerCardHeader>
              <StickerCardContent>
                <p className="text-sm">Violet icon circle.</p>
              </StickerCardContent>
            </StickerCard>

            <StickerCard className="pt-8">
              <StickerCardIcon color="secondary">
                <Heart weight="fill" className="size-5" />
              </StickerCardIcon>
              <StickerCardHeader>
                <StickerCardTitle>Secondary Icon</StickerCardTitle>
              </StickerCardHeader>
              <StickerCardContent>
                <p className="text-sm">Pink icon circle.</p>
              </StickerCardContent>
            </StickerCard>

            <StickerCard className="pt-8" featured>
              <StickerCardIcon color="tertiary">
                <Star weight="fill" className="size-5" />
              </StickerCardIcon>
              <StickerCardHeader>
                <StickerCardTitle>Tertiary + Featured</StickerCardTitle>
              </StickerCardHeader>
              <StickerCardContent>
                <p className="text-sm">Yellow icon, pink shadow.</p>
              </StickerCardContent>
            </StickerCard>
          </div>
        </section>

        {/* ---- Inputs ---- */}
        <section className="space-y-6">
          <h2 className="font-heading text-2xl font-medium">Inputs</h2>

          <div className="max-w-md space-y-6">
            <Input placeholder="Basic input — click to see focus style" />

            <FormField>
              <FormLabel>Email Address</FormLabel>
              <FormControl placeholder="you@example.com" />
              <FormDescription>
                We&apos;ll never share your email.
              </FormDescription>
            </FormField>

            <FormField>
              <FormLabel>Username</FormLabel>
              <FormControl placeholder="@handle" />
            </FormField>

            <Input disabled placeholder="Disabled input" />
          </div>
        </section>
      </div>
    </div>
  )
}
