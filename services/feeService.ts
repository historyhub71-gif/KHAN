import { FeePayment } from '../types';
import { supabase } from '../utils/supabase';

export const feeService = {
  // Fetch fee payments for a student
  getStudentPayments: async (studentId: string): Promise<FeePayment[]> => {
    const { data, error } = await supabase
      .from('fee_payments')
      .select('*, fee_receipts(receipt_number)')
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .order('due_date', { ascending: false });

    if (error) throw error;

    return (data || []).map((p: any) => ({
      ...p,
      receipt_number: p.fee_receipts?.receipt_number,
    }));
  },

  // NOTE: Teacher fee collection has been REMOVED.
  // Only the Director can collect fees directly (see collectPaymentDirectly).


  // Admin & Teacher: Get unpaid / overdue students list
  getUnpaidStudents: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('fee_payments')
      .select('*, profiles:student_id(id, name, email)')
      .eq('status', 'unpaid')
      .is('deleted_at', null)
      .order('due_date', { ascending: true });

    if (error) throw error;

    return (data || []).map((p: any) => ({
      payment_id: p.id,
      student_id: p.profiles?.id,
      student_name: p.profiles?.name,
      student_email: p.profiles?.email,
      amount: p.amount,
      due_date: p.due_date,
      is_overdue: new Date(p.due_date) < new Date(),
    }));
  },

  // System: Check fee status monthly and generate reminders
  runMonthlyFeeCheck: async (): Promise<{ generated: number }> => {
    const { data: students, error: studentError } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('role', 'student')
      .eq('approved', true);

    if (studentError) throw studentError;

    let generatedCount = 0;
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0);

    for (const student of (students || [])) {
      const { data: existing, error: existError } = await supabase
        .from('fee_payments')
        .select('id')
        .eq('student_id', student.id)
        .gte('due_date', startOfMonth.toISOString().slice(0, 10))
        .lte('due_date', endOfMonth.toISOString().slice(0, 10))
        .is('deleted_at', null)
        .maybeSingle();

      if (existError) continue;

      if (!existing) {
        const standardAmount = 15000;
        const dueDate = new Date(currentYear, currentMonth, 10);

        const { error: insertError } = await supabase
          .from('fee_payments')
          .insert({
            student_id: student.id,
            amount: standardAmount,
            due_date: dueDate.toISOString().slice(0, 10),
            status: 'unpaid',
          });

        if (insertError) continue;

        await supabase.from('notifications').insert({
          user_id: student.id,
          role: 'student',
          notification_type: 'Monthly Fee Due Reminder',
          title: 'Monthly Tuition Fee Due',
          message: `Your tuition fee of Rs. ${standardAmount} for the month is due by ${dueDate.toLocaleDateString()}. Please make a payment.`,
          read: false,
        });

        generatedCount++;
      }
    }

    const { data: unpaidPayments } = await supabase
      .from('fee_payments')
      .select('*, profiles:student_id(name)')
      .eq('status', 'unpaid')
      .is('deleted_at', null);

    if (unpaidPayments) {
      for (const payment of unpaidPayments) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { count } = await supabase
          .from('notification_history')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', payment.student_id)
          .eq('notification_type', 'Fee Overdue Reminder')
          .gte('created_at', sevenDaysAgo.toISOString());

        if (count === 0) {
          await supabase.from('notifications').insert({
            user_id: payment.student_id,
            role: 'student',
            notification_type: 'Fee Overdue Reminder',
            title: 'OVERDUE: Tuition Fee Alert',
            message: `URGENT: Your tuition fee of Rs. ${payment.amount} due on ${payment.due_date} is overdue. Please submit payment immediately.`,
            read: false,
          });
        }
      }
    }

    return { generated: generatedCount };
  },

  // Admin: Send manual reminder to a specific student
  sendManualReminder: async (studentId: string, paymentId: string): Promise<void> => {
    const { data: payment } = await supabase
      .from('fee_payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (!payment) throw new Error('Payment record not found');

    await supabase.from('notifications').insert({
      user_id: studentId,
      role: 'student',
      notification_type: 'Fee Overdue Reminder',
      title: 'Manual Fee Reminder Alert',
      message: `Admin has sent a manual reminder for your tuition fee of Rs. ${payment.amount} which was due on ${payment.due_date}.`,
      read: false,
    });
  },

  // Soft delete fee payment
  deletePayment: async (id: string, userId: string): Promise<void> => {
    const { error } = await supabase
      .from('fee_payments')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', id);

    if (error) throw error;
  },

  // Fetch notification reminder logs
  getReminderHistory: async (studentId?: string): Promise<any[]> => {
    let query = supabase
      .from('notification_history')
      .select('*, profiles:user_id(name)')
      .in('notification_type', ['Monthly Fee Due Reminder', 'Fee Overdue Reminder'])
      .order('created_at', { ascending: false });

    if (studentId) {
      query = query.eq('user_id', studentId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row: any) => ({
      ...row,
      student_name: row.profiles?.name,
    }));
  },

  // Admission Deal Management
  getAdmissionDeals: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('admission_deals')
      .select('*, courses:course_id(name)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      course_name: d.courses?.name || 'Unknown Course',
    }));
  },

  createAdmissionDeal: async (params: {
    studentName: string;
    studentEmail: string;
    courseId: string;
    originalFee: number;
    discountAmount: number;
    discountPercentage: number;
    finalFee: number;
    paymentStatus: 'pending' | 'paid';
    remarks: string;
    adminId: string;
  }): Promise<any> => {
    const { data: deal, error: dealErr } = await supabase
      .from('admission_deals')
      .insert({
        student_name: params.studentName,
        student_email: params.studentEmail,
        course_id: params.courseId,
        original_fee: params.originalFee,
        discount_amount: params.discountAmount,
        discount_percentage: params.discountPercentage,
        final_fee: params.finalFee,
        payment_status: params.paymentStatus,
        remarks: params.remarks,
      })
      .select()
      .single();

    if (dealErr) throw dealErr;

    if (params.discountAmount > 0) {
      await supabase.from('admission_discounts').insert({
        deal_id: deal.id,
        discount_amount: params.discountAmount,
        discount_percentage: params.discountPercentage,
        remarks: params.remarks || 'Admission Discount',
      });
    }

    await supabase.from('fee_agreements').insert({
      deal_id: deal.id,
      agreed_amount: params.finalFee,
      notes: params.remarks || 'Initial Agreement',
    });

    await supabase.from('payment_status_tracking').insert({
      deal_id: deal.id,
      status: params.paymentStatus,
      changed_by: params.adminId,
    });

    return deal;
  },

  updateAdmissionDeal: async (id: string, params: {
    studentName: string;
    studentEmail: string;
    courseId: string;
    originalFee: number;
    discountAmount: number;
    discountPercentage: number;
    finalFee: number;
    paymentStatus: 'pending' | 'paid';
    remarks: string;
    adminId: string;
  }): Promise<any> => {
    const { data: currentDeal, error: fetchErr } = await supabase
      .from('admission_deals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr) throw fetchErr;

    const { data: updatedDeal, error: dealErr } = await supabase
      .from('admission_deals')
      .update({
        student_name: params.studentName,
        student_email: params.studentEmail,
        course_id: params.courseId,
        original_fee: params.originalFee,
        discount_amount: params.discountAmount,
        discount_percentage: params.discountPercentage,
        final_fee: params.finalFee,
        payment_status: params.paymentStatus,
        remarks: params.remarks,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (dealErr) throw dealErr;

    if (currentDeal.discount_amount !== params.discountAmount || currentDeal.discount_percentage !== params.discountPercentage) {
      await supabase.from('admission_discounts').insert({
        deal_id: id,
        discount_amount: params.discountAmount,
        discount_percentage: params.discountPercentage,
        remarks: `Updated discount: ${params.remarks || 'No notes'}`,
      });
    }

    if (currentDeal.final_fee !== params.finalFee) {
      await supabase.from('fee_agreements').insert({
        deal_id: id,
        agreed_amount: params.finalFee,
        notes: `Updated fee agreement: ${params.remarks || 'No notes'}`,
      });
    }

    if (currentDeal.payment_status !== params.paymentStatus) {
      await supabase.from('payment_status_tracking').insert({
        deal_id: id,
        status: params.paymentStatus,
        changed_by: params.adminId,
      });
    }

    return updatedDeal;
  },

  markAdmissionDealAsPaid: async (id: string, adminId: string): Promise<any> => {
    const { data: deal, error: dealErr } = await supabase
      .from('admission_deals')
      .update({
        payment_status: 'paid',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (dealErr) throw dealErr;

    await supabase.from('payment_status_tracking').insert({
      deal_id: id,
      status: 'paid',
      changed_by: adminId,
    });

    return deal;
  },

  // Director directly collects fee — instantly marks as PAID, generates receipt.
  // remainingBalance is entered by the Director; it is NOT auto-calculated.
  collectPaymentDirectly: async (params: {
    studentId: string;
    paymentId?: string;
    amount: number;
    paymentMethod: FeePayment['payment_method'];
    notes: string;
    submittedBy: string;
    paymentDate: string;
    remainingBalance: number; // Director enters this — no auto-calculation
  }): Promise<any> => {
    let paymentRecord: FeePayment;

    const dueDate = new Date();
    dueDate.setDate(1);
    dueDate.setMonth(dueDate.getMonth() + 1);
    const dueDateStr = dueDate.toISOString().slice(0, 10);

    if (params.paymentId) {
      const { data, error } = await supabase
        .from('fee_payments')
        .update({
          status: 'paid',
          amount: params.amount,
          payment_method: params.paymentMethod,
          payment_date: params.paymentDate,
          notes: params.notes,
          submitted_by: params.submittedBy,
          balance_after: params.remainingBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.paymentId)
        .select()
        .single();

      if (error) throw error;
      paymentRecord = data as FeePayment;
    } else {
      const { data, error } = await supabase
        .from('fee_payments')
        .insert({
          student_id: params.studentId,
          amount: params.amount,
          due_date: dueDateStr,
          status: 'paid',
          payment_method: params.paymentMethod,
          payment_date: params.paymentDate,
          notes: params.notes,
          submitted_by: params.submittedBy,
          balance_after: params.remainingBalance,
        })
        .select()
        .single();

      if (error) throw error;
      paymentRecord = data as FeePayment;
    }

    // Create fee_ledger entry with remaining_balance set to manual input
    const { error: ledgerErr } = await supabase.rpc('record_fee_ledger_manual', {
      p_student_id:        params.studentId,
      p_total_fee:         params.amount + params.remainingBalance,
      p_paid_amount:       params.amount,
      p_remaining_balance: params.remainingBalance,
      p_collected_by:      params.submittedBy,
      p_remarks:           params.notes || 'Payment collected directly by Director',
      p_payment_date:      params.paymentDate,
    });

    if (ledgerErr) throw ledgerErr;

    // Generate receipt
    const { data: receiptData, error: receiptErr } = await supabase
      .from('fee_receipts')
      .insert({ payment_id: paymentRecord.id })
      .select()
      .single();

    if (receiptErr) throw receiptErr;

    const { data: updatedReceipt } = await supabase
      .from('fee_receipts')
      .select('receipt_number')
      .eq('id', receiptData.id)
      .single();

    const receiptNumber = updatedReceipt?.receipt_number || 'RCPT-TEMP';

    // Fetch student name
    const { data: studentProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', params.studentId)
      .single();

    const studentName = studentProfile?.name || 'Student';

    // Notify student — use remainingBalance (Director-entered)
    const notificationMessage =
      `Payment Received: Dear ${studentName}, Rs. ${params.amount} received on ` +
      `${new Date(params.paymentDate).toLocaleDateString()} via ${params.paymentMethod}. ` +
      `Receipt: ${receiptNumber}. Remaining balance: Rs. ${params.remainingBalance.toFixed(2)}.`;

    await supabase.from('notifications').insert({
      user_id: params.studentId,
      role: 'student',
      notification_type: 'payment_approved',
      title: 'Fee Payment Received',
      message: notificationMessage,
      read: false,
    });

    return {
      ...paymentRecord,
      receipt_number: receiptNumber,
      student_name: studentName,
      balance_after: params.remainingBalance,
    };
  },

  getAllFeeRecords: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('fee_payments')
      .select(`
        *,
        studentProfile: student_id (id, name, email),
        directorProfile: submitted_by (id, name),
        fee_receipts (receipt_number, created_at)
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch all student-course associations to map student to course names
    const { data: studentCourses, error: scError } = await supabase
      .from('course_students')
      .select('student_id, courses(name, code)');

    const studentCourseMap: Record<string, string[]> = {};
    if (!scError && studentCourses) {
      studentCourses.forEach((sc: any) => {
        if (!sc.student_id || !sc.courses) return;
        if (!studentCourseMap[sc.student_id]) {
          studentCourseMap[sc.student_id] = [];
        }
        studentCourseMap[sc.student_id].push(`${sc.courses.name} (${sc.courses.code})`);
      });
    }

    // Compute remaining balances for each student
    const studentUnpaidBalances: Record<string, number> = {};
    (data || []).forEach((p: any) => {
      if (p.status === 'unpaid') {
        studentUnpaidBalances[p.student_id] = (studentUnpaidBalances[p.student_id] || 0) + Number(p.amount);
      }
    });

    return (data || []).map((p: any) => {
      const studentName = p.studentProfile?.name || 'Unknown';
      const directorName = p.directorProfile?.name || 'N/A';
      const receiptNumber = p.fee_receipts?.receipt_number || 'N/A';
      const receiptTime = p.fee_receipts?.created_at || '';
      const course = studentCourseMap[p.student_id]?.join(', ') || 'No Course';
      const remainingBalance = studentUnpaidBalances[p.student_id] || 0;

      let statusDisplay: 'PAID' | 'UNPAID' | 'OVERDUE' = 'UNPAID';
      if (p.status === 'paid') {
        statusDisplay = 'PAID';
      } else if (p.status === 'unpaid') {
        const isOverdue = new Date(p.due_date) < new Date();
        statusDisplay = isOverdue ? 'OVERDUE' : 'UNPAID';
      } else if (p.status === 'rejected') {
        statusDisplay = 'UNPAID';
      } else if (p.status === 'pending') {
        statusDisplay = 'UNPAID';
      }

      return {
        id: p.id,
        student_id: p.student_id,
        student_name: studentName,
        student_email: p.studentProfile?.email || '',
        course,
        amount: Number(p.amount),
        remaining_balance: remainingBalance,
        payment_method: p.payment_method || 'None',
        payment_date: p.payment_date,
        collection_date: p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '—',
        director_name: directorName,
        receipt_number: receiptNumber,
        receipt_time: receiptTime,
        notes: p.notes || '',
        status: statusDisplay,
        due_date: p.due_date,
        balance_before: p.balance_before,
        balance_after: p.balance_after,
        created_at: p.created_at,
      };
    });
  },

  // ─── Fee Ledger ────────────────────────────────────────────────────────────

  // Record a fee ledger entry.
  // IMPORTANT: remainingBalance is manually entered by the Director — NOT auto-calculated.
  // The Director-entered value becomes the official remaining balance.
  recordFeeLedger: async (params: {
    studentId: string;
    totalFee: number;
    paidAmount: number;
    remainingBalance: number; // Director manually enters this
    remarks: string;
    collectedBy: string;
    paymentDate: string;
  }): Promise<any> => {
    const { data, error } = await supabase.rpc('record_fee_ledger_manual', {
      p_student_id:        params.studentId,
      p_total_fee:         params.totalFee,
      p_paid_amount:       params.paidAmount,
      p_remaining_balance: params.remainingBalance,
      p_collected_by:      params.collectedBy,
      p_remarks:           params.remarks,
      p_payment_date:      params.paymentDate,
    });

    if (error) throw error;

    return { id: data, remaining_balance: params.remainingBalance };
  },

  // Get fee ledger for a student
  getStudentFeeLedger: async (studentId: string): Promise<any[]> => {
    const { data, error } = await supabase
      .from('fee_ledger')
      .select('*, collector:collected_by(name)')
      .eq('student_id', studentId)
      .order('payment_date', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      ...row,
      collected_by_name: row.collector?.name,
    }));
  },

  // Get all fee ledger entries (director view)
  getAllFeeLedger: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('fee_ledger')
      .select('*, student:student_id(name, email), collector:collected_by(name)')
      .order('payment_date', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      ...row,
      student_name: row.student?.name,
      student_email: row.student?.email,
      collected_by_name: row.collector?.name,
    }));
  },
};
