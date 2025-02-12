ase 'work_orders': {
          let query = supabase
            .from('work_orders')
            .select('*')
            .gte('created_at', startStr)
            .lte('created_at', endStr);

          if (!isCombined) {
            query = query.in('branch', branchesToReport);
          }

          ({ data, error } = await query);
          if (error) throw error;
          fetchedData = data;
          break;
        }