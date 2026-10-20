<template>
  <p v-if="authors.length" class="publication-authors">
      <template v-for="(author, index) in authors" :key="index">
        <span class="publication-author"><strong v-if="author.is_self">{{ author.name }}</strong><span v-else>{{ author.name }}</span><sup v-if="author.is_co_first">†</sup><span v-if="index < authors.length - 1">,</span></span><template v-if="index < authors.length - 1">{{ ' ' }}</template>
      </template>
      <span v-if="authors.some(author => author.is_co_first)" class="contribution-note">{{ t('resume.equalContribution') }}</span>
  </p>
</template>

<script setup>
import { computed } from 'vue'
import { publicationAuthors } from '~/utils/resumePublications.js'
const props = defineProps({ item: { type: Object, required: true }, profileName: { type: String, default: '' } })
const { t } = useI18n()
const authors = computed(() => publicationAuthors(props.item, props.profileName))
</script>

<style scoped>
.publication-authors { margin: 4px 0; color: #666666; font-size: 0.9375em; line-height: 1.6; }
.publication-author { display: inline-block; white-space: nowrap; }
.publication-authors strong { font-weight: 700; }
.publication-authors sup { font-size: 0.7em; }
.contribution-note { display: inline-block; margin-left: 0.75em; font-size: 0.9em; }
</style>
