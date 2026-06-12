import { useState, useEffect } from "react";

export type COANode = {
  id: string;
  code: string;
  name: string;
  type: string;
  children?: COANode[];
};

const LEGACY_DEFAULT_COA: COANode[] = [
  {
    id: "1", code: "1000", name: "Assets", type: "Asset",
    children: [
      { id: "11", code: "1100", name: "Cash", type: "Asset" },
      { id: "12", code: "1200", name: "Bank — Main account", type: "Asset" },
      { id: "13", code: "1300", name: "Accounts Receivable", type: "Asset" },
    ],
  },
  {
    id: "2", code: "2000", name: "Liabilities", type: "Liability",
    children: [
      { id: "21", code: "2100", name: "Accounts Payable", type: "Liability" },
      { id: "22", code: "2200", name: "Loans", type: "Liability" },
    ],
  },
  {
    id: "3", code: "3000", name: "Equity", type: "Equity",
    children: [{ id: "31", code: "3100", name: "Owner's capital", type: "Equity" }],
  },
  {
    id: "4", code: "4000", name: "Revenue", type: "Income",
    children: [
      { id: "41", code: "4100", name: "Product sales", type: "Income" },
      { id: "42", code: "4200", name: "Services", type: "Income" },
    ],
  },
  {
    id: "5", code: "5000", name: "Expenses", type: "Expense",
    children: [
      { id: "51", code: "5100", name: "Salaries", type: "Expense" },
      { id: "52", code: "5200", name: "Rent", type: "Expense" },
      { id: "53", code: "5300", name: "Software", type: "Expense" },
    ],
  },
];

export const DEFAULT_COA: COANode[] = [
  {
    id: "1", code: "1000", name: "Assets", type: "Asset",
    children: [
      {
        id: "11", code: "1100", name: "Accounts Receivable", type: "Asset",
        children: [
          { id: "111", code: "1110", name: "Trade Receivables", type: "Asset" },
          { id: "112", code: "1120", name: "Accrued Revenues", type: "Asset" },
        ],
      },
      {
        id: "12", code: "1200", name: "Cash and Bank", type: "Asset",
        children: [
          { id: "121", code: "1210", name: "Cash on Hand", type: "Asset" },
          { id: "122", code: "1220", name: "Bank Accounts", type: "Asset" },
          { id: "123", code: "1230", name: "Payment Processors", type: "Asset" },
        ],
      },
      {
        id: "13", code: "1300", name: "Current Assets", type: "Asset",
        children: [
          { id: "131", code: "1310", name: "Prepaid Expenses", type: "Asset" },
          { id: "132", code: "1320", name: "Recoverable VAT", type: "Asset" },
          { id: "133", code: "1330", name: "Withholding Tax Receivable", type: "Asset" },
          { id: "134", code: "1340", name: "Deposits with Others", type: "Asset" },
        ],
      },
      {
        id: "14", code: "1400", name: "Fixed Assets", type: "Asset",
        children: [
          { id: "141", code: "1410", name: "Furniture and Fixtures", type: "Asset" },
          { id: "142", code: "1420", name: "Machinery and Equipment", type: "Asset" },
          { id: "143", code: "1430", name: "Software and Systems", type: "Asset" },
          { id: "144", code: "1440", name: "Vehicles and Transportation", type: "Asset" },
          { id: "145", code: "1450", name: "Computers and Accessories", type: "Asset" },
          { id: "146", code: "1460", name: "Accumulated Depreciation", type: "Asset" },
        ],
      },
    ],
  },
  {
    id: "2", code: "2000", name: "Liabilities", type: "Liability",
    children: [
      {
        id: "21", code: "2100", name: "Current Liabilities", type: "Liability",
        children: [
          { id: "211", code: "2110", name: "Suppliers and Accounts Payable", type: "Liability" },
          { id: "212", code: "2120", name: "Accrued Expenses", type: "Liability" },
          { id: "213", code: "2130", name: "Customer Advances", type: "Liability" },
          { id: "214", code: "2140", name: "VAT Payable", type: "Liability" },
          { id: "215", code: "2150", name: "Payroll and Social Insurance Payable", type: "Liability" },
          { id: "216", code: "2160", name: "Other Payables", type: "Liability" },
        ],
      },
      {
        id: "22", code: "2200", name: "Long-Term Liabilities", type: "Liability",
        children: [
          { id: "221", code: "2210", name: "Long-Term Loans", type: "Liability" },
          { id: "222", code: "2220", name: "Lease Liabilities", type: "Liability" },
        ],
      },
    ],
  },
  {
    id: "3", code: "3000", name: "Equity", type: "Equity",
    children: [
      { id: "31", code: "3100", name: "Capital", type: "Equity" },
      { id: "32", code: "3200", name: "Owners Current Accounts", type: "Equity" },
      { id: "33", code: "3300", name: "Legal Reserve", type: "Equity" },
      { id: "34", code: "3400", name: "Retained Earnings", type: "Equity" },
      { id: "35", code: "3500", name: "Net Profit or Loss", type: "Equity" },
    ],
  },
  {
    id: "4", code: "4000", name: "Revenue", type: "Income",
    children: [
      {
        id: "41", code: "4100", name: "Operating Revenue", type: "Income",
        children: [
          { id: "411", code: "4110", name: "Product Sales", type: "Income" },
          { id: "412", code: "4120", name: "Service Revenue", type: "Income" },
          { id: "413", code: "4130", name: "Project Revenue", type: "Income" },
        ],
      },
      {
        id: "42", code: "4200", name: "Other Revenue", type: "Income",
        children: [
          { id: "421", code: "4210", name: "Interest Income", type: "Income" },
          { id: "422", code: "4220", name: "Foreign Exchange Gains", type: "Income" },
        ],
      },
    ],
  },
  {
    id: "5", code: "5000", name: "Expenses", type: "Expense",
    children: [
      {
        id: "51", code: "5100", name: "Cost of Sales", type: "Expense",
        children: [
          { id: "511", code: "5110", name: "Direct Materials", type: "Expense" },
          { id: "512", code: "5120", name: "Direct Labor", type: "Expense" },
          { id: "513", code: "5130", name: "Collection Costs", type: "Expense" },
          { id: "514", code: "5140", name: "Allowed Discounts", type: "Expense" },
        ],
      },
      {
        id: "52", code: "5200", name: "General and Administrative Expenses", type: "Expense",
        children: [
          { id: "521", code: "5210", name: "Salaries and Wages", type: "Expense" },
          { id: "522", code: "5220", name: "Freelance Labor", type: "Expense" },
          { id: "523", code: "5230", name: "Incentives and Commissions", type: "Expense" },
          { id: "524", code: "5240", name: "Employee Social Insurance", type: "Expense" },
          { id: "525", code: "5250", name: "Company Social Insurance", type: "Expense" },
          { id: "526", code: "5260", name: "Bank Charges", type: "Expense" },
          { id: "527", code: "5270", name: "Legal and Professional Fees", type: "Expense" },
          { id: "528", code: "5280", name: "Accounting Service Fees", type: "Expense" },
          { id: "529", code: "5290", name: "Software Subscriptions", type: "Expense" },
        ],
      },
      {
        id: "53", code: "5300", name: "Other Expenses", type: "Expense",
        children: [
          { id: "531", code: "5310", name: "Foreign Exchange Losses", type: "Expense" },
          { id: "532", code: "5320", name: "Capital Losses", type: "Expense" },
          { id: "533", code: "5330", name: "Miscellaneous Expenses", type: "Expense" },
        ],
      },
      {
        id: "54", code: "5400", name: "Depreciation Expenses", type: "Expense",
        children: [
          { id: "541", code: "5410", name: "Building Depreciation", type: "Expense" },
          { id: "542", code: "5420", name: "Machinery and Equipment Depreciation", type: "Expense" },
          { id: "543", code: "5430", name: "Furniture and Equipment Depreciation", type: "Expense" },
          { id: "544", code: "5440", name: "Vehicle Depreciation", type: "Expense" },
          { id: "545", code: "5450", name: "Software and Computer Depreciation", type: "Expense" },
        ],
      },
      {
        id: "55", code: "5500", name: "Government and Tax Expenses", type: "Expense",
        children: [
          { id: "551", code: "5510", name: "Fines and Penalties", type: "Expense" },
          { id: "552", code: "5520", name: "Government Fees", type: "Expense" },
          { id: "553", code: "5530", name: "Income Tax Expense", type: "Expense" },
        ],
      },
    ],
  },
];

export function useCOA() {
  const [coa, setCoa] = useState<COANode[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("hesbetak-coa");
    if (saved) {
      try {
        setCoa(JSON.parse(saved));
      } catch (e) {
        setCoa(DEFAULT_COA);
      }
    } else {
      setCoa(DEFAULT_COA);
    }
  }, []);

  const saveCOA = (newCoa: COANode[]) => {
    setCoa(newCoa);
    localStorage.setItem("hesbetak-coa", JSON.stringify(newCoa));
  };

  const addAccount = (parentId: string, newAccount: Omit<COANode, "id">) => {
    const newId = Math.random().toString(36).substring(7);
    const nodeToAdd = { ...newAccount, id: newId };

    const updateTree = (nodes: COANode[]): COANode[] => {
      return nodes.map((node) => {
        if (node.id === parentId) {
          return { ...node, children: [...(node.children || []), nodeToAdd] };
        }
        if (node.children) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };

    saveCOA(updateTree(coa));
  };

  const editAccount = (id: string, updatedFields: Partial<Omit<COANode, "id">>) => {
    const updateTree = (nodes: COANode[]): COANode[] => {
      return nodes.map((node) => {
        if (node.id === id) {
          return { ...node, ...updatedFields };
        }
        if (node.children) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };

    saveCOA(updateTree(coa));
  };

  return { coa, saveCOA, addAccount, editAccount };
}
