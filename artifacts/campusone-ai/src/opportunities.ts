export type DemoOpportunity = {
  id: string;
  title: string;
  provider: string;
  type: 'Paid internship' | 'Part-time work';
  value: number;
  majors: string[];
  workMode: 'On campus' | 'Remote' | 'Hybrid';
  requiredSkills: string[];
  hours: string;
  academicRequirement: string;
  studentYear: string;
  availability: 'Open' | 'Opening soon';
  description: string;
  demo: true;
};

export type CompanyOpportunityInput = {
  title: string;
  companyName: string;
  opportunityType: 'Internship' | 'Paid Internship' | 'Part-Time Job' | 'Graduate Opportunity' | 'Student Program';
  location: string;
  workMode: 'On-site' | 'Hybrid' | 'Remote';
  description: string;
  relevantMajors: string;
  preferredSkills: string;
  compensation: number | null;
  duration: string;
  deadline: string;
  applicationLink: string;
};

export type OpportunityMatch = DemoOpportunity & {
  matchScore: number;
  whyItMatches: string;
  potentialImpact: number;
};

export const demoOpportunities: DemoOpportunity[] = [
  { id: 'software-developer', title: 'Part-Time Software Developer', provider: 'Northstar Digital Demo', type: 'Part-time work', value: 320, majors: ['Computer Science', 'Software Engineering'], workMode: 'Hybrid', requiredSkills: ['Programming fundamentals', 'Git'], hours: '10–12 hours/week', academicRequirement: 'Completed introductory programming', studentYear: 'Second year and above', availability: 'Open', description: 'Support small product features and bug fixes around a student schedule.', demo: true },
  { id: 'web-intern', title: 'Junior Web Developer Internship', provider: 'Amman Web Studio Demo', type: 'Paid internship', value: 280, majors: ['Computer Science', 'Software Engineering', 'Information Technology'], workMode: 'Remote', requiredSkills: ['HTML', 'CSS', 'JavaScript basics'], hours: '10 hours/week', academicRequirement: 'Current technology-program enrollment', studentYear: 'Second year and above', availability: 'Open', description: 'Build and test small website updates with guidance from a development team.', demo: true },
  { id: 'data-intern', title: 'AI / Data Intern', provider: 'Jordan Data Lab Demo', type: 'Paid internship', value: 350, majors: ['Computer Science', 'Data Science', 'Artificial Intelligence'], workMode: 'Hybrid', requiredSkills: ['Spreadsheets', 'Python basics'], hours: '8–10 hours/week', academicRequirement: 'Completed an introductory data or programming course', studentYear: 'Second year and above', availability: 'Opening soon', description: 'Prepare datasets and assist with supervised analytics tasks.', demo: true },
  { id: 'campus-it', title: 'Campus IT Support Assistant', provider: 'CampusOne Demo University', type: 'Part-time work', value: 220, majors: ['Computer Science', 'Information Technology', 'All majors'], workMode: 'On campus', requiredSkills: ['Basic troubleshooting', 'Clear communication'], hours: '8 hours/week', academicRequirement: 'Current student in good standing', studentYear: 'All undergraduate years', availability: 'Open', description: 'Help students with basic lab, account, and device support requests.', demo: true },
  { id: 'social-media', title: 'Social Media Assistant', provider: 'Student Life Office Demo', type: 'Part-time work', value: 180, majors: ['Marketing', 'Business', 'Media', 'All majors'], workMode: 'Hybrid', requiredSkills: ['Writing', 'Content scheduling'], hours: '6–8 hours/week', academicRequirement: 'Current student enrollment', studentYear: 'All undergraduate years', availability: 'Open', description: 'Draft and schedule student-life updates for campus channels.', demo: true },
  { id: 'customer-support', title: 'Customer Support Representative', provider: 'MENA Services Demo', type: 'Part-time work', value: 260, majors: ['All majors'], workMode: 'Remote', requiredSkills: ['Communication', 'Problem solving'], hours: '10 hours/week', academicRequirement: 'Current student enrollment', studentYear: 'All undergraduate years', availability: 'Open', description: 'Respond to basic customer questions during scheduled evening shifts.', demo: true },
  { id: 'research-assistant', title: 'Research Assistant', provider: 'Campus Research Lab Demo', type: 'Part-time work', value: 240, majors: ['Computer Science', 'Engineering', 'Data Science', 'All majors'], workMode: 'On campus', requiredSkills: ['Attention to detail', 'Spreadsheets'], hours: '8 hours/week', academicRequirement: 'Current student in good standing', studentYear: 'Second year and above', availability: 'Opening soon', description: 'Support literature organization, data entry, and supervised research tasks.', demo: true },
  { id: 'student-ambassador', title: 'Paid Student Ambassador', provider: 'Admissions Office Demo', type: 'Part-time work', value: 160, majors: ['All majors'], workMode: 'On campus', requiredSkills: ['Public speaking', 'Reliability'], hours: '4–6 hours/week', academicRequirement: 'Current student in good standing', studentYear: 'All undergraduate years', availability: 'Open', description: 'Welcome visitors and support scheduled campus events and tours.', demo: true },
];

const COMPANY_OPPORTUNITIES_KEY = 'campusone-company-opportunities';

const splitList = (value: string) =>
  value.split(',').map((item) => item.trim()).filter(Boolean);

export function loadCompanyOpportunities(): DemoOpportunity[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = window.localStorage.getItem(COMPANY_OPPORTUNITIES_KEY);
    return stored ? (JSON.parse(stored) as DemoOpportunity[]) : [];
  } catch {
    return [];
  }
}

export function saveCompanyOpportunity(input: CompanyOpportunityInput, id?: string): DemoOpportunity {
  const opportunity: DemoOpportunity = {
    id: id ?? `company-${Date.now()}`,
    title: input.title.trim(),
    provider: input.companyName.trim(),
    type: input.opportunityType === 'Part-Time Job' ? 'Part-time work' : 'Paid internship',
    value: input.compensation ?? 0,
    majors: splitList(input.relevantMajors).length ? splitList(input.relevantMajors) : ['All majors'],
    workMode: input.workMode === 'On-site' ? 'On campus' : input.workMode,
    requiredSkills: splitList(input.preferredSkills),
    hours: input.duration.trim() || 'Flexible student schedule',
    academicRequirement: input.opportunityType === 'Graduate Opportunity' ? 'Current final-year student or recent graduate' : 'Current student enrollment',
    studentYear: 'Open to relevant students',
    availability: 'Open',
    description: `${input.description.trim()} Location: ${input.location.trim()}. Work mode: ${input.workMode}. Duration: ${input.duration.trim() || 'To be agreed'}.`,
    demo: true,
  };
  const existing = loadCompanyOpportunities().filter((item) => item.id !== opportunity.id);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(COMPANY_OPPORTUNITIES_KEY, JSON.stringify([opportunity, ...existing]));
  }
  return opportunity;
}

export function matchOpportunities(major: string, financialNeed: number): OpportunityMatch[] {
  const normalizedMajor = major.trim().toLowerCase();
  const catalog = [...loadCompanyOpportunities(), ...demoOpportunities];
  const highestValue = Math.max(...catalog.map((opportunity) => opportunity.value), 1);
  return catalog.map((opportunity) => {
    const majorMatch = opportunity.majors.some((item) => item === 'All majors' || item.toLowerCase() === normalizedMajor);
    const coverage = financialNeed > 0 ? Math.min(1, opportunity.value / financialNeed) : 0;
    const discoveryValue = Math.round((opportunity.value / highestValue) * 20);
    const valueContribution = financialNeed > 0 ? coverage * 40 : discoveryValue;
    const matchReason = majorMatch && !opportunity.majors.includes('All majors')
      ? `Matches your ${major} major and student profile`
      : 'Open across academic programs';
    return {
      ...opportunity,
      matchScore: Math.min(100, Math.round((majorMatch ? 35 : 10) + valueContribution + (opportunity.availability === 'Open' ? 20 : 10) + 5)),
      whyItMatches: `${matchReason}, ${opportunity.availability.toLowerCase()}, and ${financialNeed > 0 ? 'its estimated monthly pay could help reduce the projected financial gap' : 'its estimated value can strengthen the semester plan'}. No unprovided skills are assumed.`,
      potentialImpact: Math.min(opportunity.value, Math.max(0, financialNeed)),
    };
  }).sort((a, b) => {
    const aCompany = a.id.startsWith('company-');
    const bCompany = b.id.startsWith('company-');
    if (aCompany !== bCompany) return aCompany ? -1 : 1;
    return b.matchScore - a.matchScore || b.value - a.value;
  });
}