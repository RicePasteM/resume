import resume from '~/data/resume.json'

export default {
  async getActiveResume() {
    return { code: 200, data: resume }
  }
}
