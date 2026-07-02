# Project Overview: Attendance System - Mobile App

A comprehensive mobile-first student attendance management system built with Expo and React Native. The system utilizes a strict Role-Based Access Control (RBAC) architecture to separate financial, academic, and administrative responsibilities.

---

# Core Architecture Principles

## Existing System Protection Rule

This project already contains a complete production architecture.

DO NOT:

- Create duplicate systems
- Create duplicate workflows
- Create duplicate tables
- Create duplicate profile structures
- Create duplicate authentication flows
- Create parallel admission systems
- Create alternative enrollment systems

ALWAYS:

- Reuse existing tables
- Reuse existing services
- Reuse existing SQL functions
- Reuse existing Supabase relationships
- Reuse existing workflows

Repairs and improvements must be applied to the existing implementation only.

---

## Single Source Of Truth

Admission Deal Email is the authoritative student identity.

All records must ultimately resolve to the same student:

- Admission Deals
- Interviews
- Student Profiles
- Course Assignments
- Teacher Assignments
- Enrollments
- Notifications
- Authentication Accounts

No duplicate student records may ever be created.

---

# Role Dashboards & Business Rules

## 1. Director (Accountant / Finance Only)

The Director role is strictly limited to financial and accounting operations.

### Capabilities

- Collect tuition fees
- Mark fees as paid
- Generate fee receipts
- Print fee receipts
- Share fee receipts
- View fee records
- View student ledgers
- View payment history
- View financial reports
- View revenue reports

### Financial Metrics

- Total Revenue
- Paid Fees
- Unpaid Fees
- Overdue Fees
- Revenue Trends

### Restrictions

Director MUST NOT:

- Manage users
- Approve admissions
- Conduct interviews
- Assign courses
- Assign teachers
- Manage teachers
- Manage students
- Manage attendance
- Manage salaries
- Perform academic oversight

### Services

Primary:

- feeService
- pdfReportService

Read Only:

- adminService

---

## 2. ASR / Interviewer (Assessment & Academic Placement)

The ASR handles all student assessments and academic placement recommendations.

### Responsibilities

Conduct:

- Admission Interviews
- Progress Reviews
- Academic Evaluations

Record:

- Assigned Level
- Strengths
- Weaknesses
- Recommendations

Recommend:

- Course Assignment
- Teacher Assignment
- Class Assignment

### Restrictions

ASR MUST NOT:

- Collect fees
- Approve discounts
- Manage payments
- Approve admissions
- Manage fee records
- Make financial decisions

### Services

Primary:

- interviewerService
- admissionService

---

## 3. Operational Roles

### Admin

Responsible for:

- User approvals
- System administration
- Admission review
- Admission authorization
- Student activation
- Final approval of academic placement

### Teacher

Responsible for:

- Attendance
- Student monitoring
- Academic progress tracking
- Progress reports
- Student evaluations

Teachers can view:

- Student Profile
- Interview Results
- Assigned Level
- Strengths
- Weaknesses
- Recommendations
- Attendance
- Course Progress

### Student

Can access:

- Attendance
- Notifications
- Fee Status
- Assigned Course
- Assigned Teacher
- Academic Information

---

# Admission Approval & Student Authentication Workflow

## IMPORTANT

This workflow is authoritative.

Do not create alternative workflows.

Repair existing implementation only.

---

## STEP 1 — Admission Deal Creation

Admin creates an Admission Deal.

Required:

- Student Name
- Student Email
- Course
- Fee Details

The Admission Deal Email becomes the student's official institutional email.

---

## STEP 2 — ASR Interview

ASR conducts interview.

ASR records:

- Level
- Strengths
- Weaknesses
- Recommendations
- Assigned Course
- Assigned Teacher
- Assigned Class

Interview status becomes:

Pending Admin Review

---

## STEP 3 — Admin Review & Approve

Admin reviews interview.

Admin clicks:

REVIEW & APPROVE

This action must exist and function correctly.

If broken:

Repair existing workflow.

Do not create a replacement workflow.

---

## STEP 4 — Automatic Academic Preparation

When Review & Approve succeeds:

System automatically prepares the student.

Create or update:

- Student Profile
- Admission Relationships
- Student Enrollment
- Course Assignment
- Teacher Assignment
- Class Assignment
- Academic Relationships
- Notifications
- Required Student Records

Everything required academically must be completed here.

Student should already be academically prepared before signup.

---

## STEP 5 — Student Signup

Student opens application.

Student signs up using:

- Approved Admission Email
- Password

System verifies:

- Approved Admission Exists
- Email Matches Admission Deal

If valid:

- Create Auth Account
- Link Auth Account To Existing Student Record
- Activate Student Access
- Allow Login

---

# Critical Signup Rule

Signup must NEVER create academic data.

During Signup:

DO NOT CREATE:

- Course Assignments
- Teacher Assignments
- Class Assignments
- Student Enrollments
- Admission Records
- Academic Relationships

Signup should ONLY:

- Verify Email
- Create Auth Account
- Link Auth Account
- Activate Access

All academic preparation must already exist.

---

# Login Workflow

Admin Creates Deal

↓

ASR Conducts Interview

↓

Admin Review & Approve

↓

Student Prepared

↓

Student Signs Up

↓

Auth Account Created

↓

Linked To Existing Student Record

↓

Student Logs In

↓

Welcome Notification Appears

---

# Welcome Notification Rule

Do not send final admission notification before signup.

After first successful login:

Create notification:

Title:

Admission Approved

Include:

- Assigned Course
- Assigned Class
- Assigned Teacher
- Assigned Level

Notification must use the existing notification system.

---

# Main Technologies

## Framework

- Expo
- React Native
- Expo Router

## Backend

- Supabase Auth
- Supabase Database
- Supabase Realtime
- Supabase RPC

## State Management

- React Context API

---

# Database Design Rules

Reuse existing tables.

Expected core tables:

- profiles
- admission_deals
- interviews
- student_profiles
- student_enrollments
- attendance
- notifications
- fee_payments
- fee_ledger
- fortnight_reviews
- courses
- classes

Do not create duplicate profile tables.

Do not create duplicate enrollment tables.

Do not create duplicate admission systems.

---

# Service Architecture

All Supabase communication must remain inside services.

## Core Services

### feeService

Responsible for:

- Fee Collection
- Fee Ledger
- Payment Tracking

### interviewerService

Responsible for:

- Interviews
- Assessments
- Progress Reviews

### admissionService

Responsible for:

- Admission Workflow
- Interview Approval Flow
- Student Preparation Flow

---

# Required Analysis Before Any Changes

Always analyze:

- MASTER_SETUP.sql
- Admission Workflow
- Interview Workflow
- Student Signup Flow
- Notification Workflow
- Teacher Assignment Workflow
- Existing Supabase Relationships

Before implementing changes.

---

# Expected Final Result

Admin Creates Deal

↓

ASR Conducts Interview

↓

Admin Review & Approve

↓

Student Record Fully Prepared

↓

Student Signs Up Using Approved Email

↓

Auth Account Linked

↓

Student Logs In Successfully

↓

Welcome Notification Displayed

Expected Outcome:

- No Foreign Key Errors
- No Missing Relationship Errors
- No Teacher Assignment Errors
- No Course Assignment Errors
- No Duplicate Student Records
- No Duplicate Workflows
- No Manual Database Fixes Required

## Teacher Attendance & Salary Deduction Policy

This policy is authoritative.

Reuse the existing Teacher Attendance System.

Do not create a duplicate attendance workflow.

### Teacher Attendance

Teachers must perform:

* Daily Check-In
* Daily Check-Out

Attendance status is calculated automatically.

---

### Attendance Status Rules

#### Present

Teacher arrives on time.

Status:

Present

Salary Deduction:

None

---

#### Late

Teacher arrives late.

Status:

Late

Salary Deduction:

None

A single Late record must not deduct salary.

---

#### Repeated Late Policy

If a teacher accumulates 2 Late records:

Automatically convert:

2 Late = 1 Absent

After conversion:

* Late counter resets
* One Absent record is created

Salary Deduction:

1 Day Salary Deduction

---

#### Absent

Teacher misses a scheduled working day.

Status:

Absent

Salary Deduction:

1 Day Salary Deduction

---

### Salary Deduction Rules

1 Late = No Deduction

2 Late = 1 Absent and salary deduction of 1 day

1 Absent = 1 Day Salary Deduction

All salary deductions must be calculated using the existing salary management system.

Do not create a separate deduction system.

Reuse existing attendance and salary workflows.

---

### Admin Permissions

Admin can:

* View Teacher Attendance
* View Late Records
* View Absent Records
* View Salary Deductions
* View Monthly Attendance Reports

---

### Director Restrictions

Director MUST NOT:

* Manage Teacher Attendance
* Manage Teacher Salaries
* Modify Salary Deductions

These permissions belong exclusively to Admin.


# Development Commands

Install:

```bash
npm install

Start:

```bash
npx expo start

Android:

```bash
npm run android

iOS:

```bash
npm run ios

Web:

```bash
npm run web

Database Setup:

```bash
npm run db:setup

Verify Notifications:

```bash
npm run db:verify

Lint:

```bash
npm run lint

```     