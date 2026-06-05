import { useState, useEffect } from "react";

export type COANode = {
  id: string;
  code: string;
  name: string;
  type: string;
  children?: COANode[];
};

export const DEFAULT_COA: COANode[] = [
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
